import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, saveLevelingConfig, getUserLevelData } from '../../services/leveling.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { logger } from '../../utils/logger.js';
import levelDashboard from './modules/level_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Leveling system commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Set up the leveling system')
                .addChannelOption(opt =>
                    opt
                        .setName('channel')
                        .setDescription('Level-up message channel')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('xp_min')
                        .setDescription('Minimum XP per message')
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('xp_max')
                        .setDescription('Maximum XP per message')
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('dashboard')
                .setDescription('Open leveling dashboard')
        )

        .addSubcommand(sub =>
            sub
                .setName('check')
                .setDescription('Check your level and XP')
        ),

    category: 'Leveling',

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();

            // =====================
            // CHECK (USER)
            // =====================
            if (subcommand === 'check') {
                const data = await getUserLevelData(interaction.user.id);

                if (!data) {
                    return interaction.reply({
                        content: "You don't have any XP yet.",
                        ephemeral: true,
                    });
                }

                return interaction.reply({
                    embeds: [
                        createEmbed({
                            title: `${interaction.user.username}'s Level`,
                            description:
                                `📊 **Level:** ${data.level}\n` +
                                `⭐ **XP:** ${data.xp}`,
                            color: getColor('primary'),
                        }),
                    ],
                    ephemeral: true,
                });
            }

            // =====================
            // DASHBOARD
            // =====================
            if (subcommand === 'dashboard') {
                return levelDashboard.execute(interaction, config, client);
            }

            // =====================
            // SETUP (ADMIN)
            // =====================
            if (subcommand === 'setup') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({
                        content: "You need Manage Server permission.",
                        ephemeral: true,
                    });
                }

                const channel = interaction.options.getChannel('channel');
                const xpMin = interaction.options.getInteger('xp_min') ?? 15;
                const xpMax = interaction.options.getInteger('xp_max') ?? 25;

                if (xpMin > xpMax) {
                    return interaction.reply({
                        content: "XP min cannot be greater than XP max.",
                        ephemeral: true,
                    });
                }

                if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
                    return interaction.reply({
                        content: `I need SendMessages and EmbedLinks in ${channel}`,
                        ephemeral: true,
                    });
                }

                const configData = await getLevelingConfig(client, interaction.guildId);

                if (configData?.configured) {
                    return interaction.reply({
                        content: "Leveling is already configured. Use /level dashboard.",
                        ephemeral: true,
                    });
                }

                const newConfig = {
                    ...configData,
                    configured: true,
                    enabled: true,
                    levelUpChannel: channel.id,
                    xpRange: {
                        min: xpMin,
                        max: xpMax,
                    },
                };

                await saveLevelingConfig(client, interaction.guildId, newConfig);

                return interaction.reply({
                    embeds: [
                        createEmbed({
                            title: 'Leveling Enabled',
                            description:
                                `📢 Channel: ${channel}\n` +
                                `⭐ XP Range: ${xpMin}-${xpMax}`,
                            color: 'success',
                        }),
                    ],
                    ephemeral: true,
                });
            }

        } catch (error) {
            logger.error(error);

            if (!interaction.replied) {
                await interaction.reply({
                    content: "Something went wrong while running this command.",
                    ephemeral: true,
                });
            }
        }
    },
};
};
