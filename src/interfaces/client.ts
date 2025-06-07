import { Client, Collection } from "discord.js";
import { Manager } from "../lib/sinsacord/src"

export interface ClientBot extends Client {
    slashCommands: Collection<string, any>,
    messageCommands: Collection<string, any>,
    manager: Manager,
}
