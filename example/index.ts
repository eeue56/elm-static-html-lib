import elmStaticHtml from "elm-static-html-lib";
import * as fs from "fs";

const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel" };

elmStaticHtml(process.cwd(), "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});