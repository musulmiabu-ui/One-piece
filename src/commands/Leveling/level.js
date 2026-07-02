import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, saveLevelingConfig, getUserLevelData } from '../../services/leveling.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import levelDashboard from './modules/level_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Manage the leveling system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        // SETUP
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Set up the leveling system')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Channel for level-up messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_min')
                        .setDescription('Minimum XP per message')
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_max')
                        .setDescription('Maximum XP per message')
                        .setRequired(false),
                )
        )

        // DASHBOARD
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open leveling dashboard')
        )

        // CHECK (USER COMMAND)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('check')
                .setDescription('Check your level and XP')
        ),

    category: 'Leveling',

    async execute(interaction, config, client) {

            const subcommand = interaction.options.getSubcommand();

            // =====================
            // CHECK LEVEL (USER)
            // =====================
            if (subcommand === 'check') {
                const data = await getUserLevelData(interaction.user.id);

                if (!data) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        content: "You don't have any XP yet.",
                    });
                }

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: `${interaction.user.username}'s Level`,
                            description:
                                `📊 **Level:** ${data.level}\n` +
                                `⭐ **XP:** ${data.xp}`,
                            color: getColor('primary'),
                        }),
                    ],
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
                const channel = interaction.options.getChannel('channel');
                const xpMin = interaction.options.getInteger('xp_min') ?? 15;
                const xpMax = interaction.options.getInteger('xp_max') ?? 25;

                if (xpMin > xpMax) {
                    return interaction.editReply({
                        content: 'XP min cannot be greater than XP max.'
                    });
                }

                if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
                    throw new TitanBotError(
                        'Missing permissions',
                        ErrorTypes.PERMISSION,
                        `I need SendMessages and EmbedLinks in ${channel}`
                    );
                }

                const configData = await getLevelingConfig(client, interaction.guildId);

                if (configData.configured) {
                    return interaction.editReply({
                        content: 'Leveling already configured. Use /level dashboard.'
                    });
                }

                const newConfig = {
                    ...configData,
                    configured: true,
                    enabled: true,
                    levelUpChannel: channel.id,
                    xpRange: { min: xpMin, max: xpMax },
                };

                await saveLevelingConfig(client, interaction.guildId, newConfig);

                return interaction.editReply({
                    embeds: [
                        createEmbed({
                            title: 'Leveling Enabled',
                            description: `Channel: ${channel}\nXP: ${xpMin}-${xpMax}`,
                            color: 'success',
                        }),
                    ],
                });
            }

        } catch (error) {
            logger.error(error);
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'level',
            });
        }
    },
};
