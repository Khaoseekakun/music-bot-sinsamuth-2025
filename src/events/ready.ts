import { client } from "..";

client.on("ready", () => {
    console.log('Bot is ready')

    client.application.commands.set(client.slashCommands.map((c) => c)).catch((e) => {
        console.log(e)
        console.log("Command register error")
    }).then(() => {
        console.log("Command register success")
    })
})