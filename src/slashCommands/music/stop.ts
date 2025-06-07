import { ApplicationCommandOptionType, ApplicationCommandType, CommandInteraction, GuildMember, TextChannel, VoiceChannel } from "discord.js";
import { ClientBot } from "../../interfaces/client";
import { loadTracks, playerCreate } from "../../functions/lavalink/Manager";

export default {
    name: 'stop',
    description: "ปิดเพลง",
    type: ApplicationCommandType.ChatInput,

    run: async (client: ClientBot, interaction: CommandInteraction) => {
        if (!client.manager.initiated) return interaction.reply({
            content: "ระบบเพลงยังไม่พร้อมใช้งาน"
        })

        try {
            const player = client.manager.get(interaction.guild.id)
            if (!player || !player.current) return interaction.reply({
                content: "ไม่มีเพลงอะไรเล่นอยู่ตอนนี้"
            })

            player.destroy()
            return interaction.reply({
                content: "เพลงถูกปิดแล้ว"
            })
        } catch (error) {
            return interaction.reply({
                content: "ไม่มีเพลงอะไรเล่นอยู่ตอนนี้"
            })
        }
    }
}