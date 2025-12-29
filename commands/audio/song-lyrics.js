const { SlashCommandBuilder } = require('discord.js');
const {
    TextDisplayBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Search and get lyrics of a music')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('Song name or artist (e.g., "shape of you" or "Ed Sheeran")')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('query');

      
        const loadingContainer = new ContainerBuilder().setAccentColor(0xFFA500);
        loadingContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🔍 Searching\n\nQuery: **${query}**`)
        );
        await interaction.editReply({
            components: [loadingContainer],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => {});

        try {
           
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
            const searchResponse = await fetch(searchUrl);

            if (!searchResponse.ok) {
                return this.sendError(interaction, 'Search service unavailable. Try again later.');
            }

            const searchResults = await searchResponse.json();

            if (!searchResults || searchResults.length === 0) {
                return this.sendNotFound(interaction, query);
            }

         
            const song = searchResults[0];

           
            if (song.instrumental) {
                return this.sendInstrumental(interaction, song);
            }

           
            if (!song.plainLyrics && !song.syncedLyrics) {
                return this.sendNotFound(interaction, query);
            }

         
            const lyrics = song.plainLyrics || song.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2}\] /g, '');

          
            const headerContainer = new ContainerBuilder().setAccentColor(0x1DB954);
            headerContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 🎵 ${song.trackName}\n\n` +
                    `**Artist:** ${song.artistName}\n` +
                    `**Album:** ${song.albumName || 'Unknown'}\n` +
                    `**Duration:** ${this.formatDuration(song.duration)}\n\n` +
                    `**Full Lyrics Below:**`
                )
            );

            await interaction.editReply({
                components: [headerContainer],
                flags: MessageFlags.IsComponentsV2
            });

  
            const chunks = this.chunkLyrics(lyrics, 1800);

      
            for (let i = 0; i < chunks.length; i++) {
                const chunkContainer = new ContainerBuilder().setAccentColor(0x1DB954);
                
                if (chunks.length > 1) {
                    chunkContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Part ${i + 1}/${chunks.length}**`)
                    );
                    chunkContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }

                chunkContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(chunks[i])
                );

                await interaction.followUp({
                    components: [chunkContainer],
                    flags: MessageFlags.IsComponentsV2
                });

         
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

     
            const buttonContainer = new ContainerBuilder().setAccentColor(0x3498db);
            buttonContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**🔗 External Links**`)
            );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Genius')
                    .setEmoji('🎤')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://genius.com/search?q=${encodeURIComponent(song.trackName + ' ' + song.artistName)}`),
                new ButtonBuilder()
                    .setLabel('Google')
                    .setEmoji('🔍')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.google.com/search?q=${encodeURIComponent(song.trackName + ' ' + song.artistName + ' lyrics')}`)
            );

            await interaction.followUp({
                components: [buttonContainer, buttons],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('[Lyrics Error]', error);
            return this.sendError(interaction, 'Failed to search lyrics. Try again later.');
        }
    },

    chunkLyrics(text, maxLength) {
        const lines = text.split('\n');
        const chunks = [];
        let currentChunk = '';

        for (const line of lines) {
        
            if ((currentChunk + line + '\n').length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        }

        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    },

    sendInstrumental(interaction, song) {
        const container = new ContainerBuilder().setAccentColor(0x9B59B6);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🎹 ${song.trackName}\n\n` +
                `**Artist:** ${song.artistName}\n` +
                `**Album:** ${song.albumName || 'Unknown'}\n` +
                `**Duration:** ${this.formatDuration(song.duration)}\n\n` +
                `🎼 **This is an instrumental track**\n\n` +
                `No lyrics available for instrumental songs.`
            )
        );

        return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    sendNotFound(interaction, query) {
        const container = new ContainerBuilder().setAccentColor(0xFF6B6B);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ❌ Lyrics Not Found\n\n` +
                `**Query:** ${query}\n\n` +
                `**Suggestions:**\n` +
                `• Try different keywords\n` +
                `• Check spelling\n` +
                `• Include artist name\n` +
                `• Use the buttons below to search manually`
            )
        );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Search Google')
                .setEmoji('🔍')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.google.com/search?q=${encodeURIComponent(query + ' lyrics')}`),
            new ButtonBuilder()
                .setLabel('Search Genius')
                .setEmoji('🎤')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://genius.com/search?q=${encodeURIComponent(query)}`)
        );

        return interaction.editReply({
            components: [container, buttons],
            flags: MessageFlags.IsComponentsV2
        });
    },

    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${String(secs).padStart(2, '0')}`;
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

