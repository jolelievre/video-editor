#!/usr/bin/env tsx
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectConfigSchema } from '@video-editor/shared';
import { listProjects, getProject } from '@video-editor/server/services/project-store';
import { startExport, getExportPath } from '@video-editor/server/services/ffmpeg';

const program = new Command();

program.name('video-cli').description('Video editor CLI for exporting projects').version('0.1.0');

program
  .command('list')
  .description('List available projects')
  .action(async () => {
    const projects = await listProjects();
    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }
    console.log('Projects:');
    for (const p of projects) {
      console.log(`  ${p.id}  ${p.name}  (updated: ${p.updatedAt})`);
    }
  });

program
  .command('export')
  .description('Export a project to video')
  .argument('[project-id]', 'Project ID to export')
  .option('-c, --config <path>', 'Path to a JSON config file')
  .action(async (projectId: string | undefined, opts: { config?: string }) => {
    let config;

    if (opts.config) {
      const raw = await readFile(resolve(opts.config), 'utf-8');
      config = projectConfigSchema.parse(JSON.parse(raw));
      console.log(`Loaded config from ${opts.config}`);
    } else if (projectId) {
      config = await getProject(projectId);
      console.log(`Loaded project: ${config.name}`);
    } else {
      console.error('Error: provide a project ID or --config <path>');
      process.exit(1);
    }

    console.log(
      `Exporting ${config.timeline.tracks.flatMap((t) => t.clips).length} clip(s)...`,
    );

    let lastPercent = -1;
    await startExport(config, {
      onProgress(percent) {
        if (percent !== lastPercent) {
          lastPercent = percent;
          process.stdout.write(`\rProgress: ${percent}%`);
        }
      },
      onDone() {
        process.stdout.write('\n');
        console.log(`Export complete: ${getExportPath(config.id)}`);
      },
      onError(error) {
        process.stdout.write('\n');
        console.error(`Export failed: ${error}`);
      },
    });
  });

program.parse();
