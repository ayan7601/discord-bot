const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType, AttachmentBuilder
} = require('discord.js');
const ticketIcons = require('../UI/icons/ticketicons');
const TicketConfig = require('../models/ticket/TicketConfig');
const TicketUserData = require('../models/ticket/TicketUserData');
const generateTranscript = require('../utils/generateTranscript');
const fs = require('fs').promises;
const path = require('path');
const setupBanners = require('../UI/banners/SetupBanners');

let configCache = {};
let lastConfigLoad = null;
const CONFIG_REFRESH_INTERVAL = 60000; 


async function loadConfig() {
    try {
        const tickets = await TicketConfig.find({});
        const newCache = {};
        
        for (const ticket of tickets) {
            newCache[ticket.serverId] = {
                ticketChannelId: ticket.ticketChannelId,
                transcriptChannelId: ticket.transcriptChannelId,
                adminRoleId: ticket.adminRoleId,
                status: ticket.status,
                categoryId: ticket.categoryId,
                closedTicketsCategoryId: ticket.closedTicketsCategoryId,
                ownerId: ticket.ownerId
            };
        }
        
        configCache = newCache;
        lastConfigLoad = Date.now();
        return configCache;
    } catch (err) {
        console.error('Error loading ticket configs:', err);
        return configCache; 
    }
}


async function getConfig(force = false) {
    if (force || !lastConfigLoad || (Date.now() - lastConfigLoad > CONFIG_REFRESH_INTERVAL)) {
        await loadConfig();
    }
    return configCache;
}

module.exports = (client) => {
  
    client.on('ready', async () => {
        //console.log('Initializing ticket system...');
        await loadConfig();
        
     
        setTimeout(() => setupTicketChannels(client), 5000);
        
       
        //setInterval(() => syncTicketChannels(client), 30 * 60 * 1000); 
        
       
        setInterval(() => cleanupStaleTickets(client), 15 * 60 * 1000);
        
        // Check for 72h inactive tickets and auto-close them
        setInterval(() => autoCloseInactiveTickets(client), 60 * 60 * 1000); // Check every hour
        
        // Delete closed tickets after 24h
        setInterval(() => deleteOldClosedTickets(client), 60 * 60 * 1000); // Check every hour
    });

 
    client.on('messageCreate', async (message) => {
        // Track activity in ticket channels - only count messages from the ticket creator
        if (message.author.bot) return;
        
        const ticketData = await TicketUserData.findOne({ ticketChannelId: message.channelId });
        if (ticketData && message.author.id === ticketData.userId) {
            ticketData.lastActivityTime = new Date();
            await ticketData.save();
        }
    });

 
    client.on('interactionCreate', async (interaction) => {

        if (interaction.isModalSubmit() && interaction.customId && interaction.customId.startsWith('ticket_modal_')) {
            await handleTicketModalSubmit(interaction, client);
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
            await handleTicketCreation(interaction, client);
        } 
      
        else if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
            await handleTicketClose(interaction, client);
        } 
    
        else if (interaction.isButton() && interaction.customId.startsWith('ping_staff_')) {
            await handleStaffPing(interaction, client);
        }

        else if (interaction.isButton() && interaction.customId.startsWith('claim_ticket_')) {
            await handleTicketClaim(interaction, client);
        }

        else if (interaction.isButton() && interaction.customId.startsWith('pin_ticket_')) {
            await handleTicketPin(interaction, client);
        }

        else if (interaction.isButton() && interaction.customId.startsWith('delete_ticket_')) {
            await handleTicketDelete(interaction, client);
        }
    });

   
    client.on('guildDelete', async (guild) => {
        try {
         
            await TicketConfig.deleteOne({ serverId: guild.id });
            await TicketUserData.deleteMany({ guildId: guild.id });
            
           
            const config = await getConfig(true);
            delete config[guild.id];
            
            console.log(`Cleaned up ticket data for deleted guild: ${guild.name} (${guild.id})`);
        } catch (err) {
            console.error(`Error cleaning up data for deleted guild ${guild.id}:`, err);
        }
    });
};


async function setupTicketChannels(client) {
    const config = await getConfig(true);
    
    for (const [guildId, settings] of Object.entries(config)) {
        if (settings.status && settings.ticketChannelId) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const ticketChannel = guild.channels.cache.get(settings.ticketChannelId);
            if (!ticketChannel) continue;
            
           
            try {
                const messages = await ticketChannel.messages.fetch({ limit: 10 });
                const botMessages = messages.filter(m => 
                    m.author.bot && 
                    m.embeds.length > 0 && 
                    m.embeds[0].data.author?.name === "Welcome to Ticket Support"
                );
                
                if (botMessages.size === 0) {
                   
                    await sendTicketEmbed(ticketChannel);
                    console.log(`Initialized ticket embed in channel ${ticketChannel.name} (${ticketChannel.id})`);
                }
            } catch (err) {
                console.error(`Error checking for ticket embeds in guild ${guildId}:`, err);
            }
        }
    }
}


async function sendTicketEmbed(channel) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "Welcome to Ticket Support", iconURL: ticketIcons.mainIcon })
        .setDescription(
            '- Please click below menu to create a new ticket.\n\n' +
            '**Ticket Guidelines:**\n' +
            '- Empty tickets are not permitted.\n' +
            '- Please be patient while waiting for a response from our support team.'
        )

        .setFooter({ text: 'We are here to Help!', iconURL: ticketIcons.modIcon })
        .setColor('#00FF00')
        .setImage(setupBanners.ticketBanner)
        .setTimestamp();

    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_type')
        .setPlaceholder('Choose ticket type')
        .addOptions([
            { label: '🆘 Support', value: 'support' },
            { label: '📂 Suggestion', value: 'suggestion' },
            { label: '💜 Feedback', value: 'feedback' },
            { label: '⚠️ Report', value: 'report' }
        ]);

    const row = new ActionRowBuilder().addComponents(menu);

    try {
        return await channel.send({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error(`Error sending ticket embed to channel ${channel.id}:`, err);
        return null;
    }
}


async function handleTicketCreation(interaction, client) {
    const { guild, user, values } = interaction;
    const ticketType = values[0];

    const config = await TicketConfig.findOne({ serverId: guild.id });
    if (!config || !config.status) {
        return interaction.reply({ 
            content: '⚠️ Ticket system is not configured or is disabled.',
            ephemeral: true 
        });
    }

    const existingTicket = await TicketUserData.findOne({ userId: user.id, guildId: guild.id });
    if (existingTicket) {
        const existingChannel = guild.channels.cache.get(existingTicket.ticketChannelId);
        if (existingChannel) {
            return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
        } else {
            await TicketUserData.deleteOne({ _id: existingTicket._id });
        }
    }

    // Show modal to collect reason/product details from user
    try {
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${guild.id}_${ticketType}_${user.id}`)
            .setTitle(`${ticketType.charAt(0).toUpperCase() + ticketType.slice(1)} Ticket Details`);

        const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_reason')
            .setLabel('Reason / Product name')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Describe the issue or enter product/service name');

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        await interaction.showModal(modal);
        return; // modal will be handled in modal submit handler
    } catch (err) {
        console.error('Failed to show ticket modal:', err);
        return interaction.reply({ content: '❌ Failed to open reason prompt. Please try again.', ephemeral: true });
    }
}

async function handleTicketModalSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const customParts = interaction.customId.split('_');
    // format: ticket_modal_<guildId>_<ticketType>_<userId>
    const guildId = customParts[2];
    const ticketType = customParts[3];
    const initiatorId = customParts[4];

    const reason = interaction.fields.getTextInputValue('ticket_reason')?.trim();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return interaction.followUp({ content: '❌ Guild not found.', ephemeral: true });

    const user = await client.users.fetch(initiatorId).catch(() => null);
    if (!user) return interaction.followUp({ content: '❌ User not found.', ephemeral: true });

    const config = await TicketConfig.findOne({ serverId: guild.id });
    if (!config || !config.status) {
        return interaction.followUp({ content: '⚠️ Ticket system is not configured or is disabled.', ephemeral: true });
    }

    const existingTicket = await TicketUserData.findOne({ userId: user.id, guildId: guild.id });
    if (existingTicket) {
        const existingChannel = guild.channels.cache.get(existingTicket.ticketChannelId);
        if (existingChannel) {
            return interaction.followUp({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
        } else {
            await TicketUserData.deleteOne({ _id: existingTicket._id });
        }
    }

    try {
        const ticketChannel = await guild.channels.create({
            name: `${ticketType}-${user.username}`,
            type: ChannelType.GuildText,
            parent: config.categoryId || null,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: config.adminRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ]
        });

        await TicketUserData.create({ userId: user.id, guildId: guild.id, ticketChannelId: ticketChannel.id, reason });

        const ticketId = `${user.id}-${ticketChannel.id}`;
        const ticketTypeDisplay = ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${ticketTypeDisplay} Ticket`)
            .setColor('#FF6B00')
            .setDescription(
                '❌ **Please provide us with a detailed description of your issue!**\n' +
                '❌ **The support staff are human volunteers, so please be patient – you\'ll get an answer as soon as possible.**\n\n' +
                `**The Name Detail Of ${ticketTypeDisplay.toLowerCase()} You Want To Buy.**\n\n` +
                '```\n' +
                (reason || '[No reason provided]') + '\n' +
                '```\n\n' +
                '⏰ **This ticket will be autoclosed when inactive for 72h!**'
            )
            .setFooter({ text: 'Your satisfaction is our priority', iconURL: ticketIcons.heartIcon })
            .setTimestamp();

        const claimButton = new ButtonBuilder().setCustomId(`claim_ticket_${ticketId}`).setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('👋');
        const pinButton = new ButtonBuilder().setCustomId(`pin_ticket_${ticketId}`).setLabel('Pin Ticket').setStyle(ButtonStyle.Primary).setEmoji('📌');
        const closeButton = new ButtonBuilder().setCustomId(`close_ticket_${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒');
        const deleteButton = new ButtonBuilder().setCustomId(`delete_ticket_${ticketId}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('✖');

        const actionRow1 = new ActionRowBuilder().addComponents(claimButton, pinButton);
        const actionRow2 = new ActionRowBuilder().addComponents(closeButton, deleteButton);

        const pingContent = config?.adminRoleId ? `${user} <@&${config.adminRoleId}>` : `${user}`;
        const allowedMentions = { users: [user.id] };
        if (config?.adminRoleId) allowedMentions.roles = [config.adminRoleId];

        await ticketChannel.send({ content: pingContent, embeds: [ticketEmbed], components: [actionRow1, actionRow2], allowedMentions });

        try { await user.send({ embeds: [new EmbedBuilder().setColor(0x0099ff).setAuthor({ name: 'Ticket Created!', iconURL: ticketIcons.correctIcon }).setDescription(`Your **${ticketType}** ticket has been created.`).addFields({ name: 'Ticket Channel', value: `${ticketChannel.url}` }).setFooter({ text: 'Thank you for reaching out!', iconURL: ticketIcons.modIcon }).setTimestamp()] }); } catch (err) { console.log(`Could not send DM to user ${user.tag}`); }

        return interaction.followUp({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
        console.error(`Error creating ticket for ${user.tag}:`, err);
        return interaction.followUp({ content: '❌ Failed to create your ticket. Please try again later.', ephemeral: true });
    }
}


async function handleTicketClose(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticketId = interaction.customId.replace('close_ticket_', '');
    const [userId, channelId] = ticketId.split('-');
    const { guild, user } = interaction;

  
    const isTicketOwner = userId === user.id;
    const config = await TicketConfig.findOne({ serverId: guild.id });
    
    if (!config) {
        return interaction.followUp({ 
            content: '❌ Ticket configuration not found.',
            ephemeral: true 
        });
    }

    const isAdmin = interaction.member.roles.cache.has(config.adminRoleId) || 
                   user.id === config.ownerId || 
                   interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if (!isTicketOwner && !isAdmin) {
        return interaction.followUp({ 
            content: '❌ You do not have permission to close this ticket.',
            ephemeral: true 
        });
    }


    try {
        const { attachment, fileName } = await generateTranscript(interaction.channel, client);

        
   
        const ticketOwner = await client.users.fetch(userId).catch(() => null);
        if (ticketOwner) {
            const dmEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setAuthor({ name: "Ticket Closed", iconURL: ticketIcons.correctIcon })
                .setDescription(`Your ticket in **${guild.name}** has been closed.`)
                .setTimestamp()
                .setFooter({ text: 'Thanks for using our support system!', iconURL: ticketIcons.modIcon });
        
            try {
                const dmMessage = await ticketOwner.send({
                    content: 'Here is your ticket transcript:',
                    embeds: [dmEmbed],
                    files: [attachment]
                });
        
                const fileUrl = dmMessage.attachments.first()?.url;
                if (fileUrl) {
                    await ticketOwner.send(`🔗 **View Transcript**: ${fileUrl}`);
                }
        
            } catch (err) {
                console.warn(`Could not DM user ${ticketOwner.tag}:`, err.message);
            }
        }
        

       
        if (config.transcriptChannelId) {
            const logChannel = guild.channels.cache.get(config.transcriptChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('Ticket Closed')
                    .addFields(
                        { name: 'Ticket', value: interaction.channel.name, inline: true },
                        { name: 'Closed By', value: user.tag, inline: true },
                        { name: 'Original Owner', value: ticketOwner?.tag || 'Unknown', inline: true }
                    )
                    .setTimestamp();
        
                const logMsg = await logChannel.send({
                    content: `📩 Transcript from ticket ${interaction.channel.name}`,
                    embeds: [logEmbed],
                    files: [attachment]
                });
        
                const fileUrl = logMsg.attachments.first()?.url;
                if (fileUrl) {
                    await logChannel.send(`🔗 **View Transcript**: ${fileUrl}`);
                }
            }
        }
        

        await interaction.followUp({ 
            content: '✅ Ticket closing in 5 seconds...',
            ephemeral: true 
        });

        // Move ticket to closed tickets category
        setTimeout(async () => {
            try {
                const channel = await guild.channels.fetch(channelId).catch(() => null);
                if (channel && config.closedTicketsCategoryId) {
                    try {
                        await channel.setParent(config.closedTicketsCategoryId, { lockPermissions: false });
                        
                        // Update permissions to make it read-only for ticket owner
                        const ticketOwnerOverwrite = channel.permissionOverwrites.cache.get(userId);
                        if (ticketOwnerOverwrite) {
                            await channel.permissionOverwrites.edit(userId, {
                                SendMessages: false,
                                AddReactions: false
                            });
                        }

                        const closedEmbed = new EmbedBuilder()
                            .setColor('#808080')
                            .setAuthor({ name: 'Ticket Closed & Archived', iconURL: ticketIcons.modIcon })
                            .setDescription('This ticket has been closed and moved to the archive. You can still view the conversation but cannot send messages.\n\n⏰ This channel will be automatically deleted after 24 hours.')
                            .setTimestamp();

                        await channel.send({ embeds: [closedEmbed] });
                        
                        // Update closedAt timestamp
                        await TicketUserData.updateOne({ userId, guildId: guild.id }, { closedAt: new Date() });
                        console.log(`Moved ticket channel ${channel.id} to closed tickets category`);
                    } catch (moveErr) {
                        console.error(`Failed to move ticket to closed category:`, moveErr);
                    }
                } else if (channel && !config.closedTicketsCategoryId) {
                    // Delete if no closed tickets category is configured
                    await channel.delete();
                    console.log(`Deleted ticket channel: ${channel.id}`);
                }

                await TicketUserData.deleteOne({ userId, guildId: guild.id });

            } catch (err) {
                console.error("Error while closing ticket:", err);
            }
        }, 5000);

    } catch (err) {
        console.error("Error generating transcript:", err);
        return interaction.followUp({ 
            content: '❌ Failed to close ticket. Please try again.',
            ephemeral: true 
        });
    }
}
async function handleStaffPing(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, channel, member } = interaction;
    const configEntry = await TicketConfig.findOne({ serverId: guild.id });

    if (!configEntry || !configEntry.adminRoleId) {
        return interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('⚠️ Staff Role Not Configured')
                    .setDescription('Unable to ping staff as no admin role is set for tickets.')
            ],
            ephemeral: true
        });
    }

    const userData = await TicketUserData.findOne({ userId: member.id, guildId: guild.id });
    const now = new Date();

    if (userData?.lastPing && (now - userData.lastPing < 6 * 60 * 60 * 1000)) {
        const nextPing = new Date(userData.lastPing.getTime() + 6 * 60 * 60 * 1000);
        return interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🕒 Cooldown Active')
                    .setDescription(`You can ping staff again <t:${Math.floor(nextPing.getTime() / 1000)}:R>.`)
            ],
            ephemeral: true
        });
    }

    const staffPingEmbed = new EmbedBuilder()
    .setColor('Orange')
    .setAuthor({ name: "Staff Assistance Requested", iconURL: ticketIcons.pingIcon })
    .setDescription(`${member} has requested support in this ticket.`)
    .setFooter({ text: 'Notification sent via the ticket system', iconURL: member.displayAvatarURL() })
    .setTimestamp();


    await channel.send({
        content: `<@&${configEntry.adminRoleId}>`,
        embeds: [staffPingEmbed]
    });

    await TicketUserData.updateOne(
        { userId: member.id, guildId: guild.id },
        { $set: { lastPing: now } },
        { upsert: true }
    );

    const confirmationEmbed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('✅ Staff Notified')
        .setDescription('A support team member has been notified and will assist you shortly.');

    await interaction.followUp({ embeds: [confirmationEmbed], ephemeral: true });
}
async function cleanupStaleTickets(client) {
    const allTickets = await TicketUserData.find({});
    for (const ticket of allTickets) {
        const guild = client.guilds.cache.get(ticket.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.ticketChannelId);
        if (!channel) {
            await TicketUserData.deleteOne({ _id: ticket._id });
            console.log(`Cleaned up stale ticket for user ${ticket.userId} in guild ${ticket.guildId}`);
        }
    }
}

async function autoCloseInactiveTickets(client) {
    try {
        const INACTIVITY_TIMEOUT = 72 * 60 * 60 * 1000; // 72 hours in milliseconds
        const now = Date.now();
        const inactiveTickets = await TicketUserData.find({ 
            lastActivityTime: { $lt: new Date(now - INACTIVITY_TIMEOUT) }
        });

        for (const ticket of inactiveTickets) {
            const guild = client.guilds.cache.get(ticket.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(ticket.ticketChannelId);
            if (!channel) {
                await TicketUserData.deleteOne({ _id: ticket._id });
                continue;
            }

            try {
                const config = await TicketConfig.findOne({ serverId: guild.id });
                if (!config) continue;

                // Send warning message about auto-close
                const warningEmbed = new EmbedBuilder()
                    .setColor('#FF6B00')
                    .setTitle('⏰ Ticket Auto-Closing')
                    .setDescription(`This ticket has been inactive for 72 hours and will be automatically closed in 5 seconds.\n\nIf you need further assistance, please open a new ticket.`)
                    .setTimestamp();

                await channel.send({ embeds: [warningEmbed] });

                // Move to closed category after 5 seconds
                setTimeout(async () => {
                    try {
                        if (config.closedTicketsCategoryId) {
                            await channel.setParent(config.closedTicketsCategoryId, { lockPermissions: false });
                            
                            // Update permissions to make it read-only
                            await channel.permissionOverwrites.edit(ticket.userId, {
                                SendMessages: false,
                                AddReactions: false
                            });

                            const closedEmbed = new EmbedBuilder()
                                .setColor('#808080')
                                .setAuthor({ name: 'Ticket Auto-Closed', iconURL: ticketIcons.modIcon })
                                .setDescription('This ticket was automatically closed due to 72 hours of inactivity.\n\n⏰ This channel will be automatically deleted after 24 hours.')
                                .setTimestamp();

                            await channel.send({ embeds: [closedEmbed] });
                            
                            // Set closedAt timestamp for auto-deletion
                            await TicketUserData.updateOne({ _id: ticket._id }, { closedAt: new Date() });
                            console.log(`Auto-closed inactive ticket: ${channel.name} (${channel.id})`);
                        } else {
                            // Delete if no closed category
                            await channel.delete('Auto-closed due to 72h inactivity');
                            console.log(`Auto-deleted inactive ticket: ${channel.name} (${channel.id})`);
                        }
                    } catch (err) {
                        console.error(`Error auto-closing ticket ${channel.id}:`, err);
                    }
                }, 5000);

                // Mark for removal from active tickets
                await TicketUserData.deleteOne({ _id: ticket._id });
            } catch (err) {
                console.error(`Error processing inactive ticket ${ticket.ticketChannelId}:`, err);
            }
        }
    } catch (err) {
        console.error('Error checking for inactive tickets:', err);
    }
}

async function deleteOldClosedTickets(client) {
    try {
        const CLOSED_TICKET_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const now = Date.now();
        const oldClosedTickets = await TicketUserData.find({ 
            closedAt: { $ne: null, $lt: new Date(now - CLOSED_TICKET_TIMEOUT) }
        });

        for (const ticket of oldClosedTickets) {
            const guild = client.guilds.cache.get(ticket.guildId);
            if (!guild) {
                await TicketUserData.deleteOne({ _id: ticket._id });
                continue;
            }

            try {
                const channel = guild.channels.cache.get(ticket.ticketChannelId);
                if (channel) {
                    await channel.delete('Auto-deleted: 24h closed ticket retention expired');
                    console.log(`Auto-deleted closed ticket: ${channel.name} (${channel.id})`);
                }
                
                await TicketUserData.deleteOne({ _id: ticket._id });
            } catch (err) {
                console.error(`Error deleting old closed ticket ${ticket.ticketChannelId}:`, err);
            }
        }
    } catch (err) {
        console.error('Error checking for old closed tickets:', err);
    }
}

module.exports.reloadTicketConfig = async function (serverId, client) {
    console.log(`[🔁] Reloading ticket config for server: ${serverId}`);
    const updatedConfig = await TicketConfig.findOne({ serverId });

    if (!updatedConfig) {
        console.warn(`[⚠️] No config found for server ${serverId}`);
        return;
    }

 
    configCache[serverId] = {
        ticketChannelId: updatedConfig.ticketChannelId,
        transcriptChannelId: updatedConfig.transcriptChannelId,
        adminRoleId: updatedConfig.adminRoleId,
        status: updatedConfig.status,
        categoryId: updatedConfig.categoryId,
        closedTicketsCategoryId: updatedConfig.closedTicketsCategoryId,
        ownerId: updatedConfig.ownerId
    };
    lastConfigLoad = Date.now();

  
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;

    const ticketChannel = guild.channels.cache.get(updatedConfig.ticketChannelId);
    if (!ticketChannel) return;

    try {
        const messages = await ticketChannel.messages.fetch({ limit: 10 });
        const alreadyHasEmbed = messages.some(m =>
            m.author.bot &&
            m.embeds.length > 0 &&
            m.embeds[0].data?.author?.name === "Welcome to Ticket Support"
        );

        if (!alreadyHasEmbed) {
            await sendTicketEmbed(ticketChannel);
            console.log(`[✅] Ticket embed sent in channel ${ticketChannel.id}`);
        } else {
            console.log(`[ℹ️] Embed already present in ${ticketChannel.id}`);
        }
    } catch (err) {
        console.error(`[❌] Error refreshing ticket embed for ${serverId}:`, err);
    }
};

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, channel } = interaction;
    const config = await TicketConfig.findOne({ serverId: guild.id });
    
    if (!config) {
        return interaction.followUp({ 
            content: '❌ Ticket configuration not found.',
            ephemeral: true 
        });
    }

    const isAdmin = interaction.member.roles.cache.has(config.adminRoleId) || 
                   user.id === config.ownerId || 
                   interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if (!isAdmin) {
        return interaction.followUp({ 
            content: '❌ Only staff members can claim tickets.',
            ephemeral: true 
        });
    }

    try {
        const claimEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setAuthor({ name: 'Ticket Claimed', iconURL: ticketIcons.correctIcon })
            .setDescription(`${user} has claimed this ticket and will assist you shortly.`)
            .setTimestamp();

        await channel.send({ embeds: [claimEmbed] });

        return interaction.followUp({ 
            content: '✅ You have claimed this ticket!',
            ephemeral: true 
        });
    } catch (err) {
        console.error(`Error claiming ticket:`, err);
        return interaction.followUp({ 
            content: '❌ Failed to claim ticket.',
            ephemeral: true 
        });
    }
}

async function handleTicketPin(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, channel } = interaction;
    const config = await TicketConfig.findOne({ serverId: guild.id });
    
    if (!config) {
        return interaction.followUp({ 
            content: '❌ Ticket configuration not found.',
            ephemeral: true 
        });
    }

    const isAdmin = interaction.member.roles.cache.has(config.adminRoleId) || 
                   user.id === config.ownerId || 
                   interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if (!isAdmin) {
        return interaction.followUp({ 
            content: '❌ Only staff members can pin tickets.',
            ephemeral: true 
        });
    }

    try {
        const pinEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: 'Ticket Pinned', iconURL: '📌' })
            .setDescription(`This ticket has been pinned for quick access.`)
            .setTimestamp();

        await channel.send({ embeds: [pinEmbed] });

        return interaction.followUp({ 
            content: '✅ Ticket pinned!',
            ephemeral: true 
        });
    } catch (err) {
        console.error(`Error pinning ticket:`, err);
        return interaction.followUp({ 
            content: '❌ Failed to pin ticket.',
            ephemeral: true 
        });
    }
}

async function handleTicketDelete(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, channel } = interaction;
    const config = await TicketConfig.findOne({ serverId: guild.id });
    
    if (!config) {
        return interaction.followUp({ 
            content: '❌ Ticket configuration not found.',
            ephemeral: true 
        });
    }

    const isAdmin = interaction.member.roles.cache.has(config.adminRoleId) || 
                   user.id === config.ownerId || 
                   interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if (!isAdmin) {
        return interaction.followUp({ 
            content: '❌ Only staff members can delete tickets.',
            ephemeral: true 
        });
    }

    try {
        const deleteEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setAuthor({ name: 'Ticket Deleted', iconURL: ticketIcons.modIcon })
            .setDescription(`This ticket is being deleted by ${user.tag}. Channel will be deleted in 5 seconds.`)
            .setTimestamp();

        await channel.send({ embeds: [deleteEmbed] });

        await interaction.followUp({ 
            content: '✅ Ticket will be deleted in 5 seconds.',
            ephemeral: true 
        });

        setTimeout(async () => {
            try {
                await channel.delete('Ticket deleted by staff');
                console.log(`Ticket channel ${channel.name} deleted by ${user.tag}`);
            } catch (err) {
                console.error(`Error deleting ticket channel:`, err);
            }
        }, 5000);
    } catch (err) {
        console.error(`Error deleting ticket:`, err);
        return interaction.followUp({ 
            content: '❌ Failed to delete ticket.',
            ephemeral: true 
        });
    }
}
