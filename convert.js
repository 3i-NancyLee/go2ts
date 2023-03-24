#!/usr/bin/env node

const fs = require("fs");

// Define a class for the NestJS schema
class NestJSSchema {
  constructor() {
    this.schema = {};
  }

  addProperty(name, type, options) {
    this.schema = this.schema || {};
    this.schema[name] = {
      type,
      ...options,
    };
  }

  create() {
    return this.schema;
  }
}

function formatOptions(options) {
  const typeMap = {
    string: "String",
    number: "Number",
    float32: "Number",
    float64: "Number",
    bool: "Boolean",
    Time: "Date",
    Duration: "Number",
    array: "Array",
  };
  return JSON.stringify({
    ...options,
    type: `mongoose.Schema.Types.${typeMap[options.type]}`,
  });
}

function convert(instance, structName, properties) {
  const structContent = properties.replace(/`/g, "\\`");
  goStruct = `const ${structName} = \`
${structContent}
\`;`;

  const propertyRegex =
    /(\w+)\s+\`json:"\w+(,omitempty)?"\sbson:"(\w+)(,omitempty)?"/g;

  // Parse the properties from the Go struct definition
  let match;

  while ((match = propertyRegex.exec(properties)) !== null) {
    const [, type, , name, optional] = match;
    const options = {
      type,
    };

    if (!optional) options.required = true;

    instance.addProperty(name, type, options);
  }
  return structName;
}

// Define the NestJS schema class
function makeNestSchemaClass(instance, structName) {
  return `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Exclude } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import * as mongoose from 'mongoose';

export type ${structName}Document = ${structName} & mongoose.Document<string>;

@Schema({
  id: true,
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
  },
  toObject: {
    virtuals: true,
    versionKey: false,
  },
})
class ${structName} {
  ${Object.entries(instance.create())
    .map(([name, options]) => {
      if (name === "_id") {
        return `@Prop({ type: mongoose.Schema.Types.String, default: uuid, hide: true })
  @Exclude()
_id: string;\n`;
      } else if (
        (name.toLowerCase() === "createdat") |
        (name.toLowerCase() === "updatedat")
      ) {
        return `@Prop()
  ${name}: Date;\n`;
      } else {
        return `@Prop(${formatOptions({ ...options })})\n  ${name}: ${
          ["Duration", "float32", "float64"].includes(
            instance.create()[name].type
          )
            ? "Number"
            : instance.create()[name].type === "Time"
            ? "Date"
            : instance.create()[name].type === "bool"
            ? "boolean"
            : instance.create()[name].type
        };\n`;
      }
    })
    .join("\n  ")}
}

const ${structName}Schema = SchemaFactory.createForClass<${structName}, ${structName}Document>(${structName});

export { ${structName}Schema, ${structName} };
`;
}

function writeToFile(destDir, structName, schemaClass) {
  const destFilePath = `${destDir}/${structName.toLowerCase()}.schema.ts`;
  fs.writeFileSync(destFilePath, schemaClass);
  console.log("Saved to dest dir: ", destFilePath);
}

let inputDirPath = "";

if (process.argv.length < 3) {
  console.log("Please provide an input directory path!");
  process.exit(1);
}

inputDirPath = `${process.cwd()}/${process.argv[2]}`;
console.log("Reading from input dir: ", inputDirPath);

const destDirPath = `${process.cwd()}/out_schemas`;
if (!fs.existsSync(destDirPath)) {
  fs.mkdirSync(destDirPath);
}

fs.readdir(inputDirPath, (err, files) => {
  if (err) {
    console.error(`Error reading directory: ${err}`);
    return;
  }

  for (const file of files) {
    const filePath = `${inputDirPath}/${file}`;

    console.log("Parsing: ", filePath);
    const fileContent = fs.readFileSync(filePath, "utf8");

    const goStructRegex = /type (\w+) struct {([\s\S]*?)}/m;
    const match = goStructRegex.exec(fileContent);

    if (match) {
      const instance = new NestJSSchema();
      const [, structName, properties] = goStructRegex.exec(match);
      convert(instance, structName, properties);
      const schemaClass = makeNestSchemaClass(instance, structName);
      writeToFile(destDirPath, structName, schemaClass);
    }
  }
});
