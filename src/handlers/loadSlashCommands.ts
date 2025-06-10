import { readdirSync } from "fs";
import { join } from "path";
import { client } from "..";

export function LoadSlashCommands() {
    const slashCommandPath = join(__dirname, "..", "slashCommands");
    const slashCommandFiles = readdirSync(slashCommandPath)

    slashCommandFiles.forEach(async (folder) => {
        const commandFiles = readdirSync(join(slashCommandPath, folder)).filter(file => file.endsWith(".js") || file.endsWith(".ts"));
        for (const file of commandFiles) {
            const slashCommand = await import(join(slashCommandPath, folder, file));
            client.slashCommands.set(slashCommand.default.name, slashCommand.default)
        }
    })
}