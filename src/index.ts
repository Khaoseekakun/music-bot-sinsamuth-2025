import { Client, Collection, GatewayIntentBits } from "discord.js"
import { ClientBot } from "./interfaces/client"
import { HandlerLoader } from "./handlers";
import { config } from "dotenv";
import { ManagerCreate } from "./functions/lavalink/Manager";
config()
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent
    ]
}) as ClientBot;

client.slashCommands = new Collection()
client.messageCommands = new Collection()
client.manager = ManagerCreate()
client.login(process.env.DISCORD_TOKEN)

export {client};
HandlerLoader()