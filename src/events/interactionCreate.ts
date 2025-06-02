import { MessageFlags } from "discord.js";
import { client } from "..";

client.on("interactionCreate", async (interaction) => {
    if (interaction.guild) {
        if (interaction.isCommand()) {
            const command = client.slashCommands.get(interaction.commandName)
            if (!command) return;
            try {
                await command.run(client, interaction)
            } catch (error) {
                console.log(error)
                interaction.reply({
                    content: "Command is not response",
                    flags: [
                        MessageFlags.Ephemeral
                    ]
                }).catch(() => { })
            }
        }
    }
})