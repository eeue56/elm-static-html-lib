# elm-static-html-lib

Generate static html by passing an optional json object to your Elm views.

Library version of elm-static-html.

## Install

```
npm install --save elm-static-html-lib
```

## Usage

### with an argument

In this example, we use `decodeModel` to turn the passed JSON into a model that our view can use.

```javascript

import elmStaticHtml from "elm-static-html-lib";


const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel" };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### without an argument

In this case, our view has the type `Html msg`.

```javascript

import elmStaticHtml from "elm-static-html-lib";


const options = { };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### With no indent

In order to truly match what Elm generates at runtime, you may not want to have spaces or indent inserted. You can do this by setting the `newLines` and `indent` options like so:

```javascript

import elmStaticHtml from "elm-static-html-lib";


const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel", newLines: false, indent: 0 };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

## multiple at once

When you want to render many views - particularly when they share dependencies - it is faster to use the `multiple` function.

```javascript
const configs = [ 
    { viewFunction: "MyModule.view", model, decoder: "MyModule.decodeModel", fileOutputName: "grouped1.html" }, 
    { viewFunction: "MyModule.lazyView", model, decoder: "MyModule.decodeModel", fileOutputName: "grouped2.html" }, 
    ];

elmStaticHtml.multiple("/absolute/path/to/elm-package.json", configs)
.then((generatedHtmls) => {
    generatedHtmls
        .map((output) => fs.writeFileSync(output.fileOutputName, output.generatedHtml));
});
```


### API description

```js
elmStaticHtml(packagePath, viewFunction, options)
```

- **packagePath** *(String)*: An absolute path to the `elm-package.json` of your project.
- **viewFunction** *(String)*: [Qualified name](https://guide.elm-lang.org/reuse/modules.html) to the view function. Format `<ModuleName>.<functionName>`
- **options** *(object)*: A map of options. Can be either empty or contain a model and a qualified decoder name. See above for usage details.

```js
elmStaticHtml.multiple(packagePath, configs)
```

- **packagePath** *(String)*: An absolute path to the `elm-package.json` of your project.
- **configs** *ViewFunctionConfig[]*: An array of configurations, see below.
- **alreadyRun?** *(Boolean)*: When true, doesn't generate boilerplate again. Useful if only your models have changed, and not your elm code.
- **elmMakePath?** *(String)*: Specify the path to elm-make.
- **installMethod** *(String)*: Specify a custom package installation command.

**returns** *Output*: An object containing the generated html and the outputFileName.

```typescript
export interface ViewFunctionConfig {
    viewFunction: string;
    fileOutputName: string;
    model?: any;
    decoder?: string;
    indent?: number;
    newLines?: boolean;
}
```

- **viewFunction**: [Qualified name](https://guide.elm-lang.org/reuse/modules.html) to the view function. Format `<ModuleName>.<functionName>`
- **fileOutputName**: File name. This value is not touched and given back to `Output`, to make saving the generated html easier
- **model?**: Optional object that is given as the model to your view function
- **decoder?**: [Qualified name](https://guide.elm-lang.org/reuse/modules.html) to the decoder for `model`. Format `<ModuleName>.<decoderName>`
- **indent?**: Optional formatting flag. Sets whether the generated html should be indented (default true)
- **newLines?**: Optional formatting flag. Sets whether new tags should start on a new line when (default true)

```typescript
export interface Output {
    generatedHtml: string;
    fileOutputName: string;
}
```

- **generatedHtml**: The html that your view has produced
- **fileOutputName**: A file name that is threaded through for convenience


### More examples


Check out the [example](https://github.com/eeue56/elm-static-html-lib/tree/master/example) folder for a more in-depth example.


## Production

If you are running this in production, you may want to only generate the boilerplate files once. You can do that by setting the option `alreadyRun` to true. When `alreadyRun` is true, the Elm app is only started -- no boilerplate is generated.

You may want to hide warnings, which you can do by setting `HIDE_WARNINGS=true` in your env.