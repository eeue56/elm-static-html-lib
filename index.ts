import { spawn } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as templates from "./templates";

/* tslint:disable-next-line */
const compile = require("node-elm-compiler").compile;

const renderDirName = ".elm-static-html";

export interface Options {
    model?: any;
    decoder?: string;
    alreadyRun?: boolean;
    elmMakePath?: string;
    installMethod?: string;
    indent?: number;
    newLines?: boolean;
}

function makeCacheDir(dirPath: string) {
    // make our cache dir
    // ignore these and try to continue anyway
    try {
        fs.mkdirSync(dirPath);
    } catch (e) {
        if (e.code !== 'EEXIST' && !process.env.HIDE_WARNINGS) console.log(`Failed to make ${dirPath}/Native due to`, e);
    }

    try {
        fs.mkdirSync(path.join(dirPath, "Native"));
    } catch (e) {
        if (e.code !== 'EEXIST' && !process.env.HIDE_WARNINGS) console.log(`Failed to make ${dirPath}/Native due to`, e);
    }
}


function runElmApp(moduleHash: string, dirPath: string, filenamesAndModels: any[][]): Promise<Output[]> {

    return new Promise((resolve, reject) => {
        const elmFile = path.join(dirPath, "elm.js");
        
        // Find and replace the placeholder
        const elmFileContent = fs.readFileSync(elmFile, 'utf-8');
        fs.writeFileSync(elmFile, elmFileContent.replace("return elm$json$Json$Encode$string('REPLACE_ME_WITH_JSON_STRINGIFY')", 'return x'));

        const Elm = require(elmFile);
        const privateName = `PrivateMain${moduleHash}`;

        if (Object.keys(Elm.Elm).indexOf(privateName) === - 1) {
            return reject("Code generation problem: Unable to find the module: " + privateName);
        }

        const elmApp = Elm.Elm[privateName].init({
            flags: filenamesAndModels
        });

        elmApp.ports[`htmlOut${moduleHash}`].subscribe(resolve);
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
            const runningProcess = spawn(installMethod, [], { cwd: dirPath });
            runningProcess.on("close", resolve);
        } else {
            resolve();
        }
    });
}

function makeHash(viewFunction: string): string {
    return createHash("MD5").update(viewFunction).digest("hex");
}

export interface ViewFunctionConfig {
    viewFunction: string;
    fileOutputName: string;
    model?: any;
    decoder?: string;
    indent?: number;
    newLines?: boolean;
}

export interface Output {
    generatedHtml: string;
    fileOutputName: string;
}

// compiles multiple view functions into one elm file
// which is much faster if you're likely to need all of them
export function multiple(
    rootDir: string, configs: ViewFunctionConfig[],
    alreadyRun?: boolean, elmMakePath?: string, installMethod?: string): Promise<Output[]> {

    // the modulehash is the hash of all view functions concated
    const moduleHash = makeHash(configs.map((config) => config.viewFunction).join(""));

    const dirPath = path.join(rootDir, renderDirName);

    if (alreadyRun === true) {
        const filenamesAndModels = configs.map((config) => [config.fileOutputName, config.model]);
        return runElmApp(moduleHash, dirPath, filenamesAndModels);
    }

    // try to load elm.json
    const originalElmPackagePath = path.join(rootDir, "elm.json");
    let elmPackage: any = null;
    try {
        elmPackage = JSON.parse(fs.readFileSync(originalElmPackagePath, "utf8"));
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    makeCacheDir(dirPath);
    wipeElmFromCache(dirPath);

    elmPackage = fixElmPackage(rootDir, elmPackage);

    const elmPackagePath = path.join(dirPath, "elm.json");
    const privateMainPath = path.join(dirPath, `PrivateMain${moduleHash}.elm`);

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const templateConfigs = configs.map((config) => { return {
           decoder: config.decoder,
           indent: config.indent,
           model: config.model,
           newLines: config.newLines,
           viewFunction: config.viewFunction,
           viewHash: makeHash(config.viewFunction)};
    },
    );

    const rendererFileContents = templates.generateRendererFile(moduleHash, templateConfigs);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    return installPackages(dirPath, installMethod).then(() => {
        return runCompiler(moduleHash, privateMainPath, dirPath, configs, elmMakePath);
    });
}

export function elmStaticHtml(rootDir: string, viewFunction: string, options: Options): Promise<string> {
    const viewHash = makeHash(viewFunction);

    const config = { decoder: options.decoder,
        fileOutputName: "placeholder",
        indent: options.indent,
        model: options.model,
        newLines: options.newLines,
        viewFunction,
        viewHash,
    };

    const dirPath = path.join(rootDir, renderDirName);

    if (options.alreadyRun === true) {
        return runElmApp(viewHash, dirPath, [[config.fileOutputName, options.model]])
            .then((outputs) => outputs[0].generatedHtml);
    }

    // try to load elm.json
    const originalElmPackagePath = path.join(rootDir, "elm.json");
    let elmPackage: any = null;
    try {
        elmPackage = JSON.parse(fs.readFileSync(originalElmPackagePath, "utf8"));
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    makeCacheDir(dirPath);
    wipeElmFromCache(dirPath);

    elmPackage = fixElmPackage(rootDir, elmPackage);

    const elmPackagePath = path.join(dirPath, "elm.json");
    const privateMainPath = path.join(dirPath, `PrivateMain${viewHash}.elm`);

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const rendererFileContents = templates.generateRendererFile(viewHash, [config]);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    return installPackages(dirPath, options.installMethod).then(() => {
        return runCompiler(viewHash, privateMainPath, dirPath, [config], options.elmMakePath)
            .then((results) => results[0].generatedHtml);
    });
}

function fixElmPackage(workingDir: string, elmPackage: any) {
    const sources = elmPackage["source-directories"].map((dir: string) => {
        return path.join(workingDir, dir);
    });
    sources.push(".");

    elmPackage["source-directories"] = sources;
    elmPackage.dependencies.direct["ThinkAlexandria/elm-html-in-elm"] = "1.0.1";
    elmPackage.dependencies.direct["elm/json"] = "1.1.3";


    return elmPackage;
}

function runCompiler(moduleHash: string,
                     privateMainPath: string,
                     rootDir: string,
                     configs: ViewFunctionConfig[], elmMakePath?: string): Promise<Output[]> {
    const options: any = {
        cwd: rootDir,
        output: "elm.js",
        optimize: true
    };

    if (elmMakePath) {
        options.pathToMake = elmMakePath;
    }

    return new Promise((resolve, reject) => {
        fs.readdir(rootDir, (err, files) => {
            const actualFiles = files.filter((name) => name.indexOf("PrivateMain") === 0);

            const compileProcess = compile(actualFiles, options);
            compileProcess.on("exit",
                (exitCode: number) => {
                    if (exitCode !== 0) {
                        return reject(exitCode);
                    }

                    const runs = runElmApp(moduleHash, rootDir,
                        configs.map((config) => [config.fileOutputName, config.model]));

                    return runs.then(resolve).catch(reject);
                },
            );
        });
    });
}
