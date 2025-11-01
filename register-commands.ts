import { REST, Routes } from 'discord.js';

const regionChoices = [
  { name: 'US', value: 'us' },
  { name: 'EU', value: 'eu' },
  { name: 'Korea', value: 'kr' },
  { name: 'Taiwan', value: 'tw' },
];

const commands = [
  {
    name: 'wowtoken',
    description: 'Get WoW Token information',
    options: [
      {
        name: 'price',
        description: 'Get the current WoW Token price',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'region',
            description: 'Region to check',
            type: 3, // STRING
            required: false,
            choices: regionChoices,
          },
        ],
      },
      {
        name: 'alert',
        description: 'Manage price alerts',
        type: 2, // SUB_COMMAND_GROUP
        options: [
          {
            name: 'set',
            description: 'Set a price alert',
            type: 1, // SUB_COMMAND
            options: [
              {
                name: 'price',
                description: 'The price threshold (in gold)',
                type: 4, // INTEGER
                required: true,
                min_value: 1000,
                max_value: 1000000,
              },
              {
                name: 'direction',
                description: 'Alert when price goes above or below the threshold (defaults to Above)',
                type: 3, // STRING
                required: false,
                choices: [
                  { name: 'Above', value: 'above' },
                  { name: 'Below', value: 'below' },
                ],
              },
              {
                name: 'region',
                description: 'Region to monitor (defaults to US)',
                type: 3, // STRING
                required: false,
                choices: regionChoices,
              },
            ],
          },
          {
            name: 'list',
            description: 'List your active price alerts',
            type: 1, // SUB_COMMAND
          },
          {
            name: 'remove',
            description: 'Remove a price alert',
            type: 1, // SUB_COMMAND
            options: [
              {
                name: 'alert_id',
                description: 'The ID of the alert to remove (from /wowtoken alert list)',
                type: 3, // STRING
                required: true,
              },
            ],
          },
        ],
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

try {
  console.log('Started refreshing application (/) commands.');

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands,
  });

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}

