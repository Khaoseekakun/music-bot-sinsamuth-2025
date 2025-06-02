import { LoadEvents } from "./loadEvent";
import { LoadSlashCommands } from "./loadSlashCommands";

export function HandlerLoader() {
    LoadEvents()
    LoadSlashCommands()
}