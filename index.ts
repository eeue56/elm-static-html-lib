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

function runElmApp(moduleHash: string, dirPath: string, filenamesAndModels: any[][]): Promise<Output[]> {

    return new Promise((resolve, reject) => {
        const Elm = require(path.join(dirPath, "elm.js"));
        const privateName = `PrivateMain${moduleHash}`;

        if (Object.keys(Elm).indexOf(privateName) === - 1) {
            return reject("Code generation problem: Unable to find the module: " + privateName);
        }

        const elmApp = Elm[privateName].worker(filenamesAndModels);

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
    filename: string;
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
        const filenamesAndModels = configs.map((config) => [config.filename, config.model]);
        return runElmApp(moduleHash, dirPath, filenamesAndModels);
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
    const privateMainPath = path.join(dirPath, `PrivateMain${moduleHash}.elm`);
    const nativePath = path.join(dirPath, "Native/Jsonify.js");

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

    const nativeString = templates.generateNativeModuleString(projectName);
    fs.writeFileSync(nativePath, nativeString);

    return installPackages(dirPath, installMethod).then(() => {
        return runCompiler(moduleHash, privateMainPath, dirPath, configs, elmMakePath);
    });
}

export default function elmStaticHtml(rootDir: string, viewFunction: string, options: Options): Promise<string> {
    const viewHash = makeHash(viewFunction);

    const config = { decoder: options.decoder
        , filename: "placeholder"
        , indent: options.indent
        , model: options.model
        , newLines: options.newLines
        , viewFunction
        , viewHash};

    const dirPath = path.join(rootDir, renderDirName);

    if (options.alreadyRun === true) {
        return runElmApp(viewHash, dirPath, [[config.filename, options.model]])
            .then((outputs) => outputs[0].generatedHtml);
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
    const privateMainPath = path.join(dirPath, `PrivateMain${viewHash}.elm`);
    const nativePath = path.join(dirPath, "Native/Jsonify.js");

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const rendererFileContents = templates.generateRendererFile(viewHash, [config]);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    const nativeString = templates.generateNativeModuleString(projectName);
    fs.writeFileSync(nativePath, nativeString);

    return installPackages(dirPath, options.installMethod).then(() => {
        return runCompiler(viewHash, privateMainPath, dirPath, [config], options.elmMakePath)
            .then((results) => results[0].generatedHtml);
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

function runCompiler(moduleHash: string,
                     privateMainPath: string,
                     rootDir: string,
                     configs: ViewFunctionConfig[], elmMakePath?: string): Promise<Output[]> {
    const options: any = {
        cwd: rootDir,
        output: "elm.js",
        yes: true,
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
                        configs.map((config) => [config.filename, config.model]));

                    return runs.then(resolve);
                },
            );
        });
    });
}
