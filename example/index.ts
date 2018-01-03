import * as elmStaticHtml from "../index";
import * as fs from "fs";

const model = { name: "Noah", age : 24 };
const secondModel = { name: "not noah", age: 74};
const firstRunOptions = { model : model, decoder: "MyModule.decodeModel", alreadyRun: false };
const secondRunOptions = { model : secondModel, decoder: "MyModule.decodeModel", alreadyRun: true };

/*

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

 */


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
    }).catch((err) =>{
        console.log(err);
    });
} 

runLazyView();

function runMultiple() {
    const configs =
        [ { viewFunction: "MyModule.view", model, decoder: "MyModule.decodeModel", output: "multiple1.html" }
        , { viewFunction: "MyModule.lazyView", model, decoder: "MyModule.decodeModel", output: "multiple2.html" }
        ];

    elmStaticHtml.grouped(process.cwd(), "MyModule", configs)
        .then((generatedHtmls) => {
            generatedHtmls
                .map((generatedHtml, i) => fs.writeFileSync(configs[i].output, generatedHtml));
        });
}

runMultiple();
