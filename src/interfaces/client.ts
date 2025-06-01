import { Client, Collection } from "discord.js";
import { Manager } from "../lib/sinsacord/src"

export interface ClientBot extends Client {
    languages: Collection<string, Object>,
    slashCommands: Collection<string, any>,
    messageCommands: Collection<string, any>,
    events: Collection<string, any>,
    manager: Manager,
}
