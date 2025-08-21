const fs = require('fs');
const path = require('path');
const { generateMcpTools } = require('./index.js');

function renderTemplate(template, data) {
  return template.replace(/<%= (.*?) %>/g, (match, key) => data[key.trim()]);
}

async function generateMcpServer(spec, outputDir, options = {}) {
  const { baseUrl: overrideBaseUrl, filters } = options;
  fs.mkdirSync(outputDir, { recursive: true });
  const projectName = path.basename(outputDir);
  const openApiTitle = spec.info.title;
  const openApiBaseUrl = overrideBaseUrl || (spec.servers && spec.servers[0] && spec.servers[0].url) || '';

  // Generate tools
  const tools = await generateMcpTools(spec, { baseUrl: openApiBaseUrl || undefined, filters });

  // Serialize tools and their handlers
  const serializedTools = tools.map(tool => {
    return `{
      name: '${tool.name}',
      description: '${tool.description.replace(/'/g, "'")}',
      inputSchema: ${JSON.stringify(tool.inputSchema, null, 2)},
      handler: (args) => genericHandler(${JSON.stringify(tool.serializationInfo)}, args)
    }`;
  }).join(',\n');

  const templateDir = path.resolve(__dirname, 'templates');
  const tsTemplateDir = path.resolve(__dirname, 'templates-ts');
  const templateFiles = fs.readdirSync(templateDir);
  const useTs = !!options.typescript;

  const files = useTs ? fs.readdirSync(tsTemplateDir) : templateFiles;
  for (const templateFile of files) {
    const templatePath = useTs ? path.join(tsTemplateDir, templateFile) : path.join(templateDir, templateFile);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const renderedContent = renderTemplate(templateContent, {
      projectName,
      openApiTitle,
      openApiBaseUrl,
      tools: serializedTools
    });

    const outputFileName = templateFile.replace('.tpl', '');
    const outputPath = path.join(outputDir, outputFileName);

    fs.writeFileSync(outputPath, renderedContent);
  }

  if (useTs) {
    // Write tsconfig.json and package.json for TS project
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        esModuleInterop: true,
        outDir: "dist",
        strict: false
      },
      include: ["./**/*.ts"]
    };
    fs.writeFileSync(path.join(outputDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
    const pkg = {
      name: projectName,
      version: '1.0.0',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js',
        dev: 'ts-node index.ts'
      },
      dependencies: { 'zod': '^3.22.4', 'express': '^4.17.1', 'body-parser': '^1.19.0', 'ws': '^8.13.0' },
      devDependencies: { 'typescript': '^5.3.3', 'ts-node': '^10.9.2' }
    };
    fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(pkg, null, 2));
  } else {
    // Write package.json for JS project
    const pkg = {
      name: projectName,
      version: '1.0.0',
      scripts: {
        start: 'node index.js'
      },
      dependencies: { 'zod': '^3.22.4', 'express': '^4.17.1', 'body-parser': '^1.19.0', 'ws': '^8.13.0' }
    };
    fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(pkg, null, 2));
  }
}

module.exports = {
  generateMcpServer
};
