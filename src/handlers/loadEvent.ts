import { readdirSync } from "fs";
import { join } from "path";
import { client } from "..";

export function LoadEvents() {
    const eventPath = join(__dirname, "..", "events");
    const eventFiles = readdirSync(eventPath).filter(file => file.endsWith(".js") || file.endsWith(".ts"))

    for (const file of eventFiles) {
        const event = require(join(eventPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.excute(...args))
        } else {
            client.on(event.name, (...args) => event.excute(...args))
        }
    }
}