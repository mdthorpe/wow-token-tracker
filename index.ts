import { Client, GatewayIntentBits, Events, EmbedBuilder, MessageFlags } from 'discord.js';
import { fetchWowTokenPrice } from './blizzard-api';
import { alertManager, type AlertDirection } from './alert-manager';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot is online as ${readyClient.user.tag}`);
  startAlertChecker();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'wowtoken') {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === null && subcommand === 'price') {
      const region = interaction.options.getString('region') ?? 'us';

      await interaction.deferReply();

      try {
        const { price, lastUpdated } = await fetchWowTokenPrice(region);

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`💰 WoW Token Price - ${region.toUpperCase()}`)
          .addFields(
            { name: 'Current Price', value: `${price.toLocaleString()} gold`, inline: true },
            {
              name: 'Last Updated',
              value: `<t:${Math.floor(lastUpdated.getTime() / 1000)}:R>`,
              inline: true,
            }
          )
          .setTimestamp()
          .setFooter({ text: 'Data from Blizzard API' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error fetching WoW Token price:', error);
        await interaction.editReply({
          content: '❌ Failed to fetch WoW Token price. Please try again later.',
        });
      }
    } else if (subcommandGroup === 'alert') {
      if (subcommand === 'set') {
        const threshold = interaction.options.getInteger('price', true);
        const direction = (interaction.options.getString('direction') ?? 'above') as AlertDirection;
        const region = interaction.options.getString('region') ?? 'us';

        const alert = alertManager.addAlert(
          interaction.user.id,
          interaction.channelId,
          region,
          threshold,
          direction
        );

        const directionText = direction === 'above' ? 'goes above' : 'drops below';
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🔔 Price Alert Created')
          .setDescription(
            `I'll mention you in this channel when the WoW Token price in **${region.toUpperCase()}** ${directionText} **${threshold.toLocaleString()} gold**.`
          )
          .addFields({ name: 'Alert ID', value: alert.id, inline: true })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === 'list') {
        const userAlerts = alertManager.getUserAlerts(interaction.user.id);

        if (userAlerts.length === 0) {
          await interaction.reply({
            content: '📭 You have no active price alerts.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('🔔 Your Active Price Alerts')
          .setDescription(
            userAlerts
              .map(
                (alert) =>
                  `**ID:** \`${alert.id}\`\n**Region:** ${alert.region.toUpperCase()}\n**Direction:** ${alert.direction === 'above' ? '📈 Above' : '📉 Below'}\n**Threshold:** ${alert.threshold.toLocaleString()} gold\n**Created:** <t:${Math.floor(alert.createdAt.getTime() / 1000)}:R>`
              )
              .join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (subcommand === 'remove') {
        const alertId = interaction.options.getString('alert_id', true);
        const removed = alertManager.removeAlert(interaction.user.id, alertId);

        if (removed) {
          await interaction.reply({
            content: `✅ Alert \`${alertId}\` has been removed.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: `❌ Alert \`${alertId}\` not found or doesn't belong to you.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  }
});

// Alert checker - runs at configured interval
function startAlertChecker() {
  const intervalMinutes = parseInt(process.env.POLL_INTERVAL_MINUTES ?? '5', 10);
  const CHECK_INTERVAL = intervalMinutes * 60 * 1000;

  setInterval(async () => {
    const alerts = alertManager.getAllActiveAlerts();
    if (alerts.length === 0) return;

    // Group alerts by region to minimize API calls
    const alertsByRegion = new Map<string, typeof alerts>();
    for (const alert of alerts) {
      const regionAlerts = alertsByRegion.get(alert.region) ?? [];
      regionAlerts.push(alert);
      alertsByRegion.set(alert.region, regionAlerts);
    }

    // Check each region
    for (const [region, regionAlerts] of alertsByRegion) {
      try {
        const { price, lastUpdated } = await fetchWowTokenPrice(region);

        // Check each alert for this region
        for (const alert of regionAlerts) {
          const isTriggered =
            (alert.direction === 'above' && price >= alert.threshold) ||
            (alert.direction === 'below' && price <= alert.threshold);

          if (isTriggered) {
            // Alert triggered!
            const channel = await client.channels.fetch(alert.channelId);
            if (channel?.isTextBased() && 'send' in channel) {
              const directionEmoji = alert.direction === 'above' ? '📈' : '📉';
              const directionText =
                alert.direction === 'above' ? 'gone above' : 'dropped below';

              const embed = new EmbedBuilder()
                .setColor(alert.direction === 'above' ? 0xff9900 : 0x00aaff)
                .setTitle(`🚨 WoW Token Price Alert! ${directionEmoji}`)
                .setDescription(
                  `<@${alert.userId}> The WoW Token price in **${region.toUpperCase()}** has ${directionText} your threshold!`
                )
                .addFields(
                  { name: 'Current Price', value: `${price.toLocaleString()} gold`, inline: true },
                  {
                    name: 'Your Threshold',
                    value: `${alert.threshold.toLocaleString()} gold`,
                    inline: true,
                  },
                  {
                    name: 'Direction',
                    value: alert.direction === 'above' ? '📈 Above' : '📉 Below',
                    inline: true,
                  },
                  {
                    name: 'Last Updated',
                    value: `<t:${Math.floor(lastUpdated.getTime() / 1000)}:R>`,
                    inline: false,
                  }
                )
                .setTimestamp();

              await channel.send({ embeds: [embed] });
              alertManager.markAsTriggered(alert.id);
              console.log(
                `✅ Alert ${alert.id} triggered for user ${alert.userId} (${alert.direction})`
              );
            }
          }
        }
      } catch (error) {
        console.error(`Error checking alerts for region ${region}:`, error);
      }
    }
  }, CHECK_INTERVAL);

  console.log(`🔔 Alert checker started (checking every ${intervalMinutes} minute${intervalMinutes === 1 ? '' : 's'})`);
}

// Keep the old message command for backwards compatibility
client.on(Events.MessageCreate, (message) => {
  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  alertManager.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot...');
  alertManager.close();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
