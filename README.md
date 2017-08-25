# elm-static-html-lib

Generate static html by passing a json object to your Elm views.

Library version of elm-static-html.

## Install

```
npm install --save elm-static-html-lib
```

## Usage

```javascript

import elmStaticHtml from "elm-static-html-lib";


const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel" };

elmStaticHtml("./", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```


Check out the [example](https://github.com/eeue56/elm-static-html-lib/tree/master/example) folder for a more in-depth example.


## Production

If you are running this in production, you may want to only generate the boilerplate files once. You can do that by setting the option `alreadyRun` to true. When `alreadyRun` is true, the Elm app is only started -- no boilerplate is generated.