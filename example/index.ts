import * as fs from "fs";
import * as elmStaticHtml from "../index";

const model = { name: "Noah", age : 24 };
const secondModel = { name: "not noah", age: 74};
const firstRunOptions = { model : model, decoder: "MyModule.decodeModel", alreadyRun: false };
const secondRunOptions = { model : secondModel, decoder: "MyModule.decodeModel", alreadyRun: true };

function runTwice() {
    elmStaticHtml.default(process.cwd(), "MyModule.view", firstRunOptions)
    .then((generatedHtml) => {
        fs.writeFileSync("output.html", generatedHtml);
        elmStaticHtml.default(process.cwd(), "MyModule.view", secondRunOptions)
        .then((generatedHtml) => {
            fs.writeFileSync("output2.html", generatedHtml);
            elmStaticHtml.default(process.cwd(), "MyModule.view", secondRunOptions)
            .then((generatedHtml) => {
                fs.writeFileSync("output3.html", generatedHtml);
            });
        });
    });
}

runTwice();

function runWithoutModel() {
    elmStaticHtml.default(process.cwd(), "MyModule.otherView", {})
    .then((generatedHtml) => {
        fs.writeFileSync("output4.html", generatedHtml);
    });
}

runWithoutModel();

function runLazyView() {
    elmStaticHtml.default(process.cwd(), "MyModule.lazyView", firstRunOptions)
    .then((generatedHtml) => {
        fs.writeFileSync("output5.html", generatedHtml);
    }).catch((err) => {
        console.log(err);
    });
}

runLazyView();

function runMultiple() {
    const configs =
        [ { viewFunction: "MyModule.view", model, decoder: "MyModule.decodeModel", filename: "grouped1.html" }
        , { viewFunction: "MyModule.lazyView", model, decoder: "MyModule.decodeModel", filename: "grouped2.html" }
        , { viewFunction: "MyModule.lazyView", model, decoder: "MyModule.decodeModel", filename: "grouped3.html" }
        ];

    elmStaticHtml.multiple(process.cwd(), configs)
        .then((generatedHtmls) => {
            generatedHtmls
                .map((output) => fs.writeFileSync(output.fileOutputName, output.generatedHtml));
        });
}

runMultiple();
