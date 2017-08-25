import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as templates from "./templates";

/* tslint:disable-next-line */
const compile = require("node-elm-compiler").compile;

const renderDirName = ".elm-static-html";

export interface Options {
    model: any;
    decoder: string;
    alreadyRun?: boolean;
    elmMakePath?: string;
    installMethod?: string;
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

function runElmApp(dirPath: string, model: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const Elm = require(path.join(dirPath, "elm.js"));
        const elmApp = Elm.PrivateMain.worker(model);
        elmApp.ports.htmlOut.subscribe(resolve);
    });
}

function wipeElmFromCache(dirPath: string) {
    try {
        const resolved = require.resolve(path.join(dirPath, "elm.js"));
        delete require.cache[resolved];
    } catch (e) {
        // ignore if we didn't have elm in the require cache
    }
}

function installPackages(dirPath: string, installMethod?: string) {
    return new Promise((resolve, reject) => {
        if (installMethod) {
            let runningProcess = spawn(installMethod, [], { cwd : dirPath});
            runningProcess.on("close", resolve);
        } else {
            resolve();
        }
    });
}

export default function elmStaticHtml(rootDir: string, viewFunction: string, options: Options): Promise<string> {
    const dirPath = path.join(rootDir, renderDirName);

    if (options.alreadyRun === true) {
        return runElmApp(dirPath, options.model);
    }

    // try to load elm-package.json
    const originalElmPackagePath = path.join(rootDir, "elm-package.json");
    let elmPackage: any = null;
    try {
        elmPackage = JSON.parse(fs.readFileSync(originalElmPackagePath, "utf8"));
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    makeCacheDir(dirPath);
    wipeElmFromCache(dirPath);

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

    return installPackages(dirPath, options.installMethod).then(() => {
        return runCompiler(privateMainPath, dirPath, options.model, options.elmMakePath);
    });
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

function runCompiler(privateMainPath: string, rootDir: string, model: any, elmMakePath?: string): Promise<string> {
    const options: any = {
        cwd: rootDir,
        output: "elm.js",
        yes: true,
    };

    if (elmMakePath) {
        options.pathToMake = elmMakePath;
    }

    return new Promise((resolve, reject) => {
        const compileProcess = compile(privateMainPath, options);
        compileProcess.on("exit",
            (exitCode: number) => {
                if (exitCode !== 0) {
                    return reject(exitCode);
                }

                return runElmApp(rootDir, model).then(resolve);
            },
        );
    });
}
