import { ApplicationCommandOptionType, ApplicationCommandType, CommandInteraction } from "discord.js";
import { ClientBot } from "../../interfaces/client";
import { prisma } from "../../functions/prisma";

export default {
    name: 'setup',
    description: "ตั้งค่าบอทสำหรับเซิร์ฟเวอร์",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'prefix',
            description: "ตั้งค่าคำนำหน้าสำหรับสั่งบอท",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'value',
                    description: "ค่านำหน้า",
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ],
        }
    ],
    run: async (client: ClientBot, interaction: CommandInteraction) => {
        const subcommand = interaction.options.data[0].name;
        if (subcommand == "prefix") {
            const preifx = interaction.options.get("value")?.value as string || null;
            prisma.prefix.findFirst({
                where: {
                    guild_id: interaction.guildId
                }
            }).then((v) => {

                if (preifx) {
                    // update
                    if (v) {
                        if (!interaction.memberPermissions.has("ManageGuild")) return interaction.reply({
                            content: "คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้"
                        }).catch(() => { })

                        prisma.prefix.update({
                            where: {
                                id: v.id
                            }, data: {
                                prefix: preifx
                            }
                        }).catch(() => {
                            return interaction.reply({
                                content: "ไม่สามารถแก้ไขข้อมูลได้"
                            }).catch(() => { })
                        }).then(() => {
                            return interaction.reply({
                                content: "แก้ไข prefix สำเร็จ"
                            }).catch(() => { })
                        })
                    } else {
                        if (!interaction.memberPermissions.has("ManageGuild")) return interaction.reply({
                            content: "คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้"
                        }).catch(() => { })

                        prisma.prefix.create({
                            data: {
                                guild_id: interaction.guildId,
                                prefix: preifx
                            }
                        }).catch(() => {
                            return interaction.reply({
                                content: "ไม่สามารถแก้ไขข้อมูลได้"
                            }).catch(() => { })
                        }).then(() => {
                            return interaction.reply({
                                content: "แก้ไข prefix สำเร็จ"
                            }).catch(() => { })
                        })
                    }

                } else {
                    return interaction.reply({
                        content: `Prefix ของเซิร์ฟเวอร์คือ : ${v ? v.prefix : process.env.PREFIX}`
                    }).catch(() => { })
                }
            })
        }
    }
}