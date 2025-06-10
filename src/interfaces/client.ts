import { Client, Collection } from "discord.js";
import { Riffy } from "riffy";

export interface ClientBot extends Client {
    slashCommands: Collection<string, any>,
    messageCommands: Collection<string, any>,
    manager: Riffy,
}
