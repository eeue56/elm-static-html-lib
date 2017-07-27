import elmStaticHtml from "elm-static-html-lib";
import * as fs from "fs";

const model = { name: "Noah", age : 24 };
const firstRunOptions = { model : model, decoder: "MyModule.decodeModel", alreadyRun: false };
const secondRunOptions = { model : model, decoder: "MyModule.decodeModel", alreadyRun: true };


function runTwice() {
    elmStaticHtml(process.cwd(), "MyModule.view", firstRunOptions)
    .then((generatedHtml) => {
        fs.writeFileSync("output.html", generatedHtml);
    }).then(() => {
        elmStaticHtml(process.cwd(), "MyModule.view", secondRunOptions)
        .then((generatedHtml) => {
            fs.writeFileSync("output2.html", generatedHtml);
        });
    });
}
