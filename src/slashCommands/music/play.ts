import { ApplicationCommandOptionType, ApplicationCommandType, CommandInteraction, GuildMember, TextChannel, VoiceChannel } from "discord.js";
import { ClientBot } from "../../interfaces/client";
import { loadTracks, playerCreate } from "../../functions/lavalink/Manager";

export default {
    name: 'play',
    description: "เปิดเพลง",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'query',
            description: "ระบุ url หรือ ชื่อเพลงจาก Youtube",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    run: async (client: ClientBot, interaction: CommandInteraction) => {
        if (!client.manager.initiated) return interaction.reply({
            content: "ระบบเพลงยังไม่พร้อมใช้งาน"
        })

        const query = interaction.options.get('query').value as string
        const member = interaction.member as GuildMember;

        if (!member.voice.channel) return interaction.reply({
            content: "โปรดเข้าร่วมห้องเสียงเพื่อเปิดเพลง"
        })

        if (interaction.guild.members.me.voice.channel && (member.voice.channelId != interaction.guild.members.me.voice.channelId)) return interaction.reply({
            content: "โปรดอยู่ห้องเดียวกับบอทเพลง"
        })

        loadTracks(query, member).then((result) => {
            const player = playerCreate(interaction.guild, interaction.channel as TextChannel, member.voice.channel as VoiceChannel)
            if (!player.playing) {
                player.connect()
            }

            if (result.loadType == "playlist") {
                result.tracks.forEach(track => {
                    player.queue.add(track)
                })

                if (!player.playing && !player.paused) {
                    player.play().catch(() => {
                        return interaction.reply({
                            content: "ไม่สามารถเล่นเพลงได้"
                        })
                    }).then(() => {
                        return interaction.reply({
                            content: `กำลังเล่น Playlist ${result.playlistInfo.name}`
                        })
                    })
                }

            }

            if (result.loadType == "track" || result.loadType == "search") {
                player.queue.add(result.tracks[0])
                player.play().catch(() => {
                    return interaction.reply({
                        content: "ไม่สามารถเล่นเพลงได้"
                    })
                }).then(() => {
                    return interaction.reply({
                        content: `กำลังเล่นเพลง ${result.tracks[0].info.title}`
                    })
                })
            }

        }).catch((e) => {
            return interaction.reply({
                content: "เกิดข้อผิดพลาดในการโหลดเพลง"
            })
        })
    }
}