import * as clc from "cli-color";
import * as _ from "lodash";

import { FirebaseError } from "../../error";
import {
  addFirebaseToCloudProjectAndLog,
  createFirebaseProjectAndLog,
  FirebaseProjectMetadata,
  getFirebaseProject,
  getOrPromptProject,
  PROJECTS_CREATE_QUESTIONS,
  promptAvailableProjectId,
} from "../../management/projects";
import { logger } from "../../logger";
import { prompt, promptOnce } from "../../prompt";
import * as utils from "../../utils";

const OPTION_NO_PROJECT = "Don't set up a default project";
const OPTION_USE_PROJECT = "Use an existing project";
const OPTION_NEW_PROJECT = "Create a new project";
const OPTION_ADD_FIREBASE = "Add Firebase to an existing Google Cloud Platform project";

/**
 * Used in init flows to keep information about the project - basically
 * a shorter version of {@link FirebaseProjectMetadata} with some additional fields.
 */
export interface ProjectInfo {
  id: string; // maps to FirebaseProjectMetadata.projectId
  label?: string;
  instance?: string; // maps to FirebaseProjectMetadata.resources.realtimeDatabaseInstance
  location?: string; // maps to FirebaseProjectMetadata.resources.locationId
}

function toProjectInfo(projectMetaData: FirebaseProjectMetadata): ProjectInfo {
  const { projectId, displayName, resources } = projectMetaData;
  return {
    id: projectId,
    label: `${projectId}` + (displayName ? ` (${displayName})` : ""),
    instance: _.get(resources, "realtimeDatabaseInstance"),
    location: _.get(resources, "locationId"),
  };
}

async function promptAndCreateNewProject(projectId: string,displayName: string): Promise<FirebaseProjectMetadata> {
  utils.logBullet(
    "If you want to create a project in a Google Cloud organization or folder, please use " +
      `"firebase projects:create" instead, and return to this command when you've created the project.`
  );
  const promptAnswer = {
      projectId: projectId,
      displayName: displayName
  };
  return await createFirebaseProjectAndLog(promptAnswer.projectId, {
      displayName: promptAnswer.displayName,
  });
}

async function promptAndAddFirebaseToCloudProject(): Promise<FirebaseProjectMetadata> {
  const projectId = await promptAvailableProjectId();
  if (!projectId) {
    throw new FirebaseError("Project ID cannot be empty");
  }
  return await addFirebaseToCloudProjectAndLog(projectId);
}

/**
 * Prompt the user about how they would like to select a project.
 * @param options the Firebase CLI options object.
 * @return the project metadata, or undefined if no project was selected.
 */
async function projectChoicePrompt(options: any): Promise<FirebaseProjectMetadata | undefined> {
   return promptAndCreateNewProject(options.projectId,options.displayName);
}

/**
 * Sets up the default project if provided and writes .firebaserc file.
 * @param setup A helper object to use for the rest of the init features.
 * @param config Configuration for the project.
 * @param options Command line options.
 */
export async function doSetup(setup: any, config: any, options: any): Promise<void> {
  setup.project = {};

  logger.info();
  logger.info(`First, let's associate this project directory with a Firebase project.`);
  logger.info(
    `You can create multiple project aliases by running ${clc.bold("firebase use --add")}, `
  );
  logger.info(`but for now we'll just set up a default project.`);
  logger.info();
  let projectMetaData;
  projectMetaData = await projectChoicePrompt(options);
  if (!projectMetaData) {
    return;
  }

  const projectInfo = toProjectInfo(projectMetaData);
  utils.logBullet(`Using project ${projectInfo.label}`);
  // write "default" alias and activate it immediately
  _.set(setup.rcfile, "projects.default", projectInfo.id);
  setup.projectId = projectInfo.id;
  setup.instance = projectInfo.instance;
  setup.projectLocation = projectInfo.location;
  utils.makeActiveProject(config.projectDir, projectInfo.id);
}
