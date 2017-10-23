import elmStaticHtml from "../index";
import * as fs from "fs";

const model = { name: "Noah", age : 24 };
const secondModel = { name: "not noah", age: 74};
const firstRunOptions = { model : model, decoder: "MyModule.decodeModel", alreadyRun: false };
const secondRunOptions = { model : secondModel, decoder: "MyModule.decodeModel", alreadyRun: true };


function runTwice() {
    elmStaticHtml(process.cwd(), "MyModule.view", firstRunOptions)
    .then((generatedHtml) => {
        fs.writeFileSync("output.html", generatedHtml);
        elmStaticHtml(process.cwd(), "MyModule.view", secondRunOptions)
        .then((generatedHtml) => {
            fs.writeFileSync("output2.html", generatedHtml);
            elmStaticHtml(process.cwd(), "MyModule.view", secondRunOptions)
            .then((generatedHtml) => {
                fs.writeFileSync("output3.html", generatedHtml);
            });
        });
    });
}

runTwice();


function runWithoutModel() {
    elmStaticHtml(process.cwd(), "MyModule.otherView", {})
    .then((generatedHtml) => {
        fs.writeFileSync("output4.html", generatedHtml);
    });
}

runWithoutModel();


function runLazyView() {
    elmStaticHtml(process.cwd(), "MyModule.lazyView", firstRunOptions)
    .then((generatedHtml) => {
        fs.writeFileSync("output5.html", generatedHtml);
    }).catch((err) =>{
        console.log(err);
    });
} 

runLazyView();