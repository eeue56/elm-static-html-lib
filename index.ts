import * as fs from "fs";
import * as path from "path";
import * as templates from "./templates";

/* tslint:disable-next-line */
const compile = require("node-elm-compiler").compile;

const renderDirName = ".elm-static-html";

export interface Options {
    model: any;
    decoder: string;
}

function makeCacheDir(dirPath: string) {
    // make our cache dir
    try {
        fs.mkdirSync(dirPath);
        fs.mkdirSync(path.join(dirPath, "Native"));
    } catch (e) {
        // ignore this and try to continue anyway
    }
}

function parseProjectName(repoName: string): string {
    return repoName
        .replace("https://github.com/", "")
        .replace(".git", "")
        .replace("/", "$");
}

export default function elmStaticHtml(rootDir: string, viewFunction: string, options: Options): Promise<string> {
    // try to load elm-package.json
    const originalElmPackagePath = path.join(rootDir, "elm-package.json");
    let elmPackage: any;
    try {
        elmPackage = require(originalElmPackagePath);
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    const dirPath = path.join(rootDir, renderDirName);
    makeCacheDir(dirPath);

    const projectName = parseProjectName(elmPackage.repository);
    elmPackage = fixElmPackage(rootDir, elmPackage);

    const elmPackagePath = path.join(dirPath, "elm-package.json");
    const privateMainPath = path.join(dirPath, "PrivateMain.elm");
    const nativePath = path.join(dirPath, "Native/Jsonify.js");

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const rendererFileContents = templates.generateRendererFile(viewFunction, options.decoder);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    const nativeString = templates.generateNativeModuleString(projectName);
    fs.writeFileSync(nativePath, nativeString);

    return runCompiler(privateMainPath, dirPath, options.model);
}

function fixElmPackage(workingDir: string, elmPackage: any) {
    elmPackage["native-modules"] = true;
    const sources = elmPackage["source-directories"].map((dir: string) => {
        return path.join(workingDir, dir);
    });
    sources.push(".");

    elmPackage["source-directories"] = sources;
    elmPackage.dependencies["eeue56/elm-html-in-elm"] = "2.0.0 <= v < 3.0.0";

    return elmPackage;
}

function runCompiler(privateMainPath: string, rootDir: string, model: any): Promise<string> {
    const options = {
        cwd: rootDir,
        output: "elm.js",
        yes: true,
    };

    return new Promise((resolve, reject) => {
        const compileProcess = compile(privateMainPath, options);
        compileProcess.on("exit",
            (exitCode: number) => {
                if (exitCode !== 0) {
                    return reject(exitCode);
                }

                const Elm = require(path.join(rootDir, "elm.js"));
                const elmApp = Elm.PrivateMain.worker(model);
                elmApp.ports.htmlOut.subscribe(resolve);
            },
        );
    });
}
