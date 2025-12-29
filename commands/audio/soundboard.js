/*const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    TextDisplayBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const https = require('https');
const fs = require('fs');
const path = require('path');


const SOUNDS = {
    airhorn: { url: 'https://www.myinstants.com/media/sounds/air-horn.mp3', name: '🎺 Air Horn', duration: 2 },
    crickets: { url: 'https://www.myinstants.com/media/sounds/crickets-chirping.mp3', name: '🦗 Crickets', duration: 3 },
    drumroll: { url: 'https://www.myinstants.com/media/sounds/drumroll-sound-effect.mp3', name: '🥁 Drum Roll', duration: 5 },
    sadviolin: { url: 'https://www.myinstants.com/media/sounds/sad-violin.mp3', name: '🎻 Sad Violin', duration: 4 },
    fart: { url: 'https://www.myinstants.com/media/sounds/dry-fart.mp3', name: '🎬 Fart', duration: 1 },
    bruh: { url: 'https://www.myinstants.com/media/sounds/movie_1.mp3', name: '😐 Bruh', duration: 2 },
    wow: { url: 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3', name: '😮 Wow', duration: 1 },
    nope: { url: 'https://www.myinstants.com/media/sounds/nope.mp3', name: '❌ Nope', duration: 2 },
    yeet: { url: 'https://www.myinstants.com/media/sounds/yeet_1.mp3', name: '🚀 Yeet', duration: 1 },
    bonk: { url: 'https://www.myinstants.com/media/sounds/bonk_7zPAD7C.mp3', name: '🔨 Bonk', duration: 1 },
    oof: { url: 'https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3', name: '💀 Oof (Roblox)', duration: 1 },
    bruh2: { url: 'https://www.myinstants.com/media/sounds/sans-titre1.mp3', name: '🤨 Vine Boom', duration: 5 },
    rickroll: { url: 'https://www.myinstants.com/media/sounds/rick-rolled-meme-aetrim1602054550919.mp3', name: '🕺 Rick Roll', duration: 10 },
    drama: { url: 'https://www.myinstants.com/media/sounds/dramatic.swf.mp3', name: '🎭 Dramatic', duration: 2 },
    mission: { url: 'https://www.myinstants.com/media/sounds/gta-san-andreas-abertura-oficial.mp3', name: '🕵️ Respect', duration: 10 },
    john: { url: 'https://www.myinstants.com/media/sounds/untitled_utIjZcq.mp3', name: '💪 John Cena', duration: 5 },
    error: { url: 'https://www.myinstants.com/media/sounds/erro.mp3', name: '⚠️ Error', duration: 2 },
    victory: { url: 'https://www.myinstants.com/media/sounds/victory_6.mp3', name: '🏆 Victory (FF)', duration: 5 },
    clown: { url: 'https://www.myinstants.com/media/sounds/clown-horn-sound-effect_1.mp3', name: '🤡 Clown Horn', duration: 2 },
    cash: { url: 'https://www.myinstants.com/media/sounds/audiojoiner120623175716.mp3', name: '💰 Cash Register', duration: 2 },
    applause: { url: 'https://www.myinstants.com/media/sounds/applause.mp3', name: '👏 Applause', duration: 5 },
    explosion: { url: 'https://www.myinstants.com/media/sounds/explosion-sound-effect.mp3', name: '💥 Explosion', duration: 2 },
    glass: { url: 'https://www.myinstants.com/media/sounds/glass-shattering.mp3', name: '🪟 Glass Breaking', duration: 2 },
    horn: { url: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3', name: '📯 Truck Horn', duration: 2 },
    scream: { url: 'https://www.myinstants.com/media/sounds/toms-screams.mp3', name: '😱 Wilhelm Scream', duration: 2 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundboard')
        .setDescription('Play sound effects in voice channel')
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play a sound effect')
                .addStringOption(opt =>
                    opt.setName('sound')
                        .setDescription('Select sound')
                        .setRequired(true)
                        .addChoices(
                            { name: '🎺 Air Horn', value: 'airhorn' },
                            { name: '🦗 Crickets', value: 'crickets' },
                            { name: '🥁 Drum Roll', value: 'drumroll' },
                            { name: '🎻 Sad Violin', value: 'sadviolin' },
                            { name: '🎬 Fart', value: 'fart' },
                            { name: '😐 Bruh', value: 'bruh' },
                            { name: '😮 Wow', value: 'wow' },
                            { name: '❌ Nope', value: 'nope' },
                            { name: '🚀 Yeet', value: 'yeet' },
                            { name: '🔨 Bonk', value: 'bonk' },
                            { name: '💀 Oof (Roblox)', value: 'oof' },
                            { name: '🤨 Vine Boom', value: 'bruh2' },
                            { name: '🕺 Rick Roll', value: 'rickroll' },
                            { name: '🎭 Dramatic', value: 'drama' },
                            { name: '🕵️ Respect', value: 'mission' },
                            { name: '💪 John Cena', value: 'john' },
                            { name: '⚠️ Error', value: 'error' },
                            { name: '🏆 Victory (FF)', value: 'victory' },
                            { name: '🤡 Clown Horn', value: 'clown' },
                            { name: '💰 Cash Register', value: 'cash' },
                            { name: '👏 Applause', value: 'applause' },
                            { name: '💥 Explosion', value: 'explosion' },
                            { name: '🪟 Glass Breaking', value: 'glass' },
                            { name: '📯 Truck Horn', value: 'horn' },
                            { name: '😱 Wilhelm Scream', value: 'scream' }
                        )))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all available sounds'))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop playing and disconnect bot'))
        .addSubcommand(sub =>
            sub.setName('random')
                .setDescription('Play a random sound effect')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'play':
                    return await this.handlePlay(interaction);
                case 'list':
                    return await this.handleList(interaction);
                case 'stop':
                    return await this.handleStop(interaction);
                case 'random':
                    return await this.handleRandom(interaction);
            }
        } catch (error) {
            console.error('[Soundboard Error]', error);
            return this.sendError(interaction, error.message);
        }
    },

    async handlePlay(interaction) {
        const soundKey = interaction.options.getString('sound');
        const sound = SOUNDS[soundKey];

    
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return this.sendError(interaction, 'You need to be in a voice channel!');
        }

       
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return this.sendError(interaction, 'I need permissions to join and speak in your voice channel!');
        }

        const existingConnection = interaction.guild.members.me.voice.channel;
        if (existingConnection && existingConnection.id !== voiceChannel.id) {
            return this.sendError(interaction, 'I\'m already playing in another voice channel!');
        }

        try {
           
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFile = path.join(tempDir, `${soundKey}_${Date.now()}.mp3`);
            await this.downloadFile(sound.url, tempFile);

      
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

        
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);

        
            const player = createAudioPlayer();
            const resource = createAudioResource(tempFile);

            connection.subscribe(player);
            player.play(resource);

           
            const container = new ContainerBuilder().setAccentColor(0x00FF00);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 🎵 Now Playing\n\n` +
                    `**Sound:** ${sound.name}\n` +
                    `**Channel:** ${voiceChannel.name}\n` +
                    `**Duration:** ~${sound.duration}s`
                )
            );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

      
            player.on(AudioPlayerStatus.Idle, () => {
        
                setTimeout(() => {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('Failed to delete temp file:', err);
                    }
                    connection.destroy();
                }, 1000);
            });

       
            player.on('error', error => {
                console.error('Audio player error:', error);
                try {
                    fs.unlinkSync(tempFile);
                } catch (err) {}
                connection.destroy();
            });

        } catch (error) {
            console.error('Playback error:', error);
            return this.sendError(interaction, 'Failed to play sound. Please try again.');
        }
    },

    async handleList(interaction) {
        const container = new ContainerBuilder().setAccentColor(0x3498db);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🎵 Available Sounds\n\nTotal: **${Object.keys(SOUNDS).length}** sound effects`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        let soundList = '';
        Object.entries(SOUNDS).forEach(([key, sound], idx) => {
            soundList += `${idx + 1}. ${sound.name} • \`${sound.duration}s\`\n`;
        });

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(soundList + `\nUse \`/soundboard play\` to play a sound!`)
        );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async handleStop(interaction) {
        const voiceChannel = interaction.guild.members.me.voice.channel;
        
        if (!voiceChannel) {
            return this.sendError(interaction, 'I\'m not in a voice channel!');
        }

        const connection = interaction.guild.members.me.voice;
        if (connection) {
            connection.disconnect();
        }

        const container = new ContainerBuilder().setAccentColor(0xFF0000);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ⏹️ Stopped\n\nDisconnected from voice channel`)
        );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async handleRandom(interaction) {
        const soundKeys = Object.keys(SOUNDS);
        const randomKey = soundKeys[Math.floor(Math.random() * soundKeys.length)];
        
    
        interaction.options._hoistedOptions = [
            { name: 'sound', type: 3, value: randomKey }
        ];

        return await this.handlePlay(interaction);
    },


    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        });
    },

    sendError(interaction, message) {
        const container = new ContainerBuilder().setAccentColor(0xFF0000);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ❌ Error\n\n${message}`)
        );
        return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};

*/