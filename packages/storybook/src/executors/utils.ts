import { joinPathFragments, logger } from '@nrwl/devkit';
import { findNodes } from 'nx/src/utils/typescript';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gte } from 'semver';
import ts = require('typescript');
import { CommonNxStorybookConfig, UiFramework } from '../utils/models';
import { CLIOptions } from '@storybook/types';

export interface NodePackage {
  name: string;
  version: string;
}

// TODO(katerina): Remove when Storybook 7
export function getStorybookFrameworkPath(uiFramework: UiFramework) {
  const serverOptionsPaths = {
    '@storybook/react': '@storybook/react/dist/cjs/server/options',
    '@storybook/html': '@storybook/html/dist/cjs/server/options',
    '@storybook/vue': '@storybook/vue/dist/cjs/server/options',
    '@storybook/vue3': '@storybook/vue3/dist/cjs/server/options',
    '@storybook/web-components':
      '@storybook/web-components/dist/cjs/server/options',
    '@storybook/svelte': '@storybook/svelte/dist/cjs/server/options',
  };

  if (isStorybookV62onwards(uiFramework)) {
    return serverOptionsPaths[uiFramework];
  } else {
    return `${uiFramework}/dist/server/options`;
  }
}

// TODO(katerina): Remove when Storybook 7
function isStorybookV62onwards(uiFramework: string) {
  const storybookPackageVersion = require(join(
    uiFramework,
    'package.json'
  )).version;

  return gte(storybookPackageVersion, '6.2.0-rc.4');
}

// TODO(katerina): Remove when Storybook 7
export function runStorybookSetupCheck(
  options: CLIOptions & CommonNxStorybookConfig
) {
  webpackFinalPropertyCheck(options);
  reactWebpack5Check(options);
}

// TODO(katerina): Remove when Storybook 7
function reactWebpack5Check(options: CLIOptions & CommonNxStorybookConfig) {
  if (options.uiFramework === '@storybook/react') {
    const source = mainJsTsFileContent(options.configDir);
    const rootSource = mainJsTsFileContent('.storybook');
    // check whether the current Storybook configuration has the webpack 5 builder enabled
    if (
      builderIsWebpackButNotWebpack5(source) &&
      builderIsWebpackButNotWebpack5(rootSource)
    ) {
      logger.warn(`
      It looks like you use Webpack 5 but your Storybook setup is not configured to leverage that
      and thus falls back to Webpack 4.
      Make sure you upgrade your Storybook config to use Webpack 5.
      
        - https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#upgrade
            
      `);
    }
  }
}

// TODO(katerina): Remove when Storybook 7
function mainJsTsFileContent(configFolder: string): ts.SourceFile {
  let storybookConfigFilePath = joinPathFragments(configFolder, 'main.js');

  if (!existsSync(storybookConfigFilePath)) {
    storybookConfigFilePath = joinPathFragments(configFolder, 'main.ts');
  }

  if (!existsSync(storybookConfigFilePath)) {
    // looks like there's no main config file, so skip
    return;
  }

  const storybookConfig = readFileSync(storybookConfigFilePath, {
    encoding: 'utf8',
  });

  return ts.createSourceFile(
    storybookConfigFilePath,
    storybookConfig,
    ts.ScriptTarget.Latest,
    true
  );
}

// TODO(katerina): Remove when Storybook 7
function webpackFinalPropertyCheck(
  options: CLIOptions & CommonNxStorybookConfig
) {
  let placesToCheck = [
    {
      path: joinPathFragments('.storybook', 'webpack.config.js'),
      result: false,
    },
    {
      path: joinPathFragments(options.configDir, 'webpack.config.js'),
      result: false,
    },
  ];

  placesToCheck = placesToCheck
    .map((entry) => {
      return {
        ...entry,
        result: existsSync(entry.path),
      };
    })
    .filter((x) => x.result === true);

  if (placesToCheck.length > 0) {
    logger.warn(
      `
  You have a webpack.config.js files in your Storybook configuration:
  ${placesToCheck.map((x) => `- "${x.path}"`).join('\n  ')}

  Consider switching to the "webpackFinal" property declared in "main.js" (or "main.ts") instead.
  ${
    options.uiFramework === '@storybook/react'
      ? 'https://nx.dev/storybook/migrate-webpack-final-react'
      : 'https://nx.dev/storybook/migrate-webpack-final-angular'
  }
    `
    );
  }
}

// TODO(katerina): Remove when Storybook 7
export function builderIsWebpackButNotWebpack5(
  storybookConfig: ts.SourceFile
): boolean {
  const importArray = findNodes(storybookConfig, [
    ts.SyntaxKind.PropertyAssignment,
  ]);
  let builderIsWebpackNot5 = false;
  importArray.forEach((parent) => {
    const identifier = findNodes(parent, ts.SyntaxKind.Identifier);
    const sbBuilder = findNodes(parent, ts.SyntaxKind.StringLiteral);
    const builderText = sbBuilder?.[0]?.getText() ?? '';
    if (
      identifier?.[0]?.getText() === 'builder' &&
      builderText.includes('webpack') &&
      !builderText.includes('webpack5')
    ) {
      builderIsWebpackNot5 = true;
    }
  });

  return builderIsWebpackNot5;
}
