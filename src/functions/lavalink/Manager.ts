import { Riffy } from "riffy";
import { client } from "../..";
import { Guild, GuildMember, TextChannel, VoiceChannel } from "discord.js";

export function ManagerCreate(): Riffy {
    return new Riffy(client, [
        {
            host: process.env.LAVALINK_HOST,
            port: Number(process.env.LAVALINK_PORT),
            password: process.env.LAVALINK_PASS,
        }
    ] as any, {
        defaultSearchPlatform: "ytsearch",
        restVersion: "v4",
        send(payload) {
            const guild = client.guilds.cache.get(payload.d.guild_id)
            if (guild) guild.shard.send(payload)
        }
    })
}

export async function loadTracks(query: string, requester: GuildMember) {
    return client.manager.resolve({ query, requester })
}

export function playerCreate(guild: Guild, textChannel: TextChannel, voiceChannel: VoiceChannel) {
    return client.manager.createConnection({
        guildId: guild.id,
        textChannel: textChannel.id,
        voiceChannel: voiceChannel.id,
        deaf: true
    })
}