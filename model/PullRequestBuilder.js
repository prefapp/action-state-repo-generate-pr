const exec = require('@actions/exec');

class PullRequestBuilder {

    constructor(prInputs, sourceBranch) {
        this.sourceBranch = sourceBranch;
        this.tenant = prInputs.tenant;
        this.application = prInputs.application;
        this.environment = prInputs.environment;
        this.service = prInputs.service;
        this.newImage = prInputs.newImage;
        this.reviewers = prInputs.reviewers;
        //It is important ot create consistent branch names as the action's idempotency relies on the branch name as the key
        this.branchName = `automated/update-image-${prInputs.tenant}-${prInputs.application}-${prInputs.environment}-${prInputs.service}`
    }

    /**
     * Executes the full workflow needed to open a PR for a given image
     */
    async openPRUpdatingImage(ghClient, yamlUtils, core) {
        // 1. CREATE BRANCH or WIPE IT IF IT ALREADY EXISTS
        if (await this.createPRBranchFrom(this.sourceBranch)) {
            core.info(`Branch ${this.branchName} does not exist in remote, creating one!`);
        } else {
            core.info(`Branch ${this.branchName} already existing. Re-set to origin/${this.sourceBranch}`)
        }

        // 2. MODIFY SERVICES' IMAGE INSIDE images.yaml
        let oldImage
        try {
            oldImage = this.updateImageInFile(yamlUtils)
        } catch (e) {
            core.info(`Skipping PR for ${this.tenant}/${this.application}/${this.environment}/${this.service}`);
            core.info(`Image did not change! old=newImage=${this.newImage} `)
            return
        }

        // 3. PUSH CHANGES TO ORIGIN
        try {
            await this.sedUpdatedImageFileToOrigin()
        } catch (e) {
            core.info(`ERROR TRYING TO COMMIT CHANGES!! Error: ${e}`);
        }

        // 4. CREATE PULL REQUEST
        let prNumber = await ghClient.branchHasOpenPR(this.branchName)
        if (prNumber === 0) {
            prNumber = await this.openNewPullRequest(ghClient, oldImage)
            core.info('\u001b[32mCreated PR number:\u001b[0m ' + prNumber);
        } else {
            core.info(`\u001b[32mThere is an open PR already for branch ${this.branchName}, pr_number=${prNumber}!\u001b[0m `);
        }

        // 5. ADD PR LABELS and REVIEWERS
        core.info('Adding labels and PR reviewers...')
        try {
            await this.setPRLabels(ghClient, prNumber)
            const reviewers = await this.addPRReviewers(ghClient, prNumber)
            core.info(`Added reviewers: ${JSON.stringify(reviewers)}`);
        } catch (e) {
            core.info(e);
            core.info('No reviewers were added!');
        }

        // 6. DETERMINE AUTO_MERGE AND TRY TO MERGE
        if (await this.tryToMerge(ghClient, yamlUtils, prNumber)) {
            core.info('Successfully merged PR number: ' + prNumber);
        } else {
            core.info('PR was not merged')
        }
    }

    /**
     * Check if these coordinates already have a branch in the remote and move inside it.
     * The branch will be created if it not already present in the remote
     */
    async createPRBranchFrom(targetBranch) {
        //CREATE BRANCH or RESET IT IF IT ALREADY EXISTS
        await exec.exec("git stash");
        await exec.exec("git checkout main");
        await exec.exec(`git reset --hard origin/${targetBranch}`);
        try {
            await exec.exec("git fetch origin " + this.branchName);
            await exec.exec("git checkout " + this.branchName);
            await exec.exec(`git reset --hard origin/${targetBranch}`);
        } catch (e) {
            await exec.exec("git checkout -b " + this.branchName);
            return true
        }
        return false
    }


    updateImageInFile(yamlUtils) {
        //MODIFY SERVICES IMAGE
        const oldImageName = yamlUtils.modifyImage(this.tenant, this.application, this.environment, this.service, this.newImage);
        if (oldImageName === this.newImage) {
            throw new Error('The image we were trying to update has not changed!')
        }
        return oldImageName
    }

    async sedUpdatedImageFileToOrigin() {
        //COMMIT LOCAL CHANGES
        await exec.exec("git add .");
        try{
            await exec.exec('git commit -m "feat: Image values updated"');
        }catch(e){
            console.log(e)
            throw new Error('Unable to commit file!')
        }
        //PUSH CHANGES TO ORIGIN
        await exec.exec("git push --force origin " + this.branchName);

    }

    /**
     * Creates a GitHub pull request from the current branch, it only sets title and body
     * @param ghClient
     * @param oldImageName
     * @returns {Promise<number|*>} Returns 0 if the branch already had a PR, and the new pr number otherwise
     */
    async openNewPullRequest(ghClient, oldImageName) {
        const prTitle = `📦 Service image update \`${this.newImage}\``;
        let prBody = `🤖 Automated PR created in [this](${ghClient.getActionUrl()}) workflow execution \n\n`;
        prBody += `Updated image \`${oldImageName}\` to \`${this.newImage}\` in service \`${this.service}\``;

        return await ghClient.createPr(this.branchName, prTitle, prBody)
    }

    /**
     * Even if the PR is opened, this method should unset old labels and set only the ones necessary
     */
    async setPRLabels(ghClient, prNumber) {
        return await ghClient.createAndSetLabels(
            prNumber,
            [`tenant/${this.tenant}`, `app/${this.application}`, `env/${this.environment}`, `service/${this.service}`])
    }

    async addPRReviewers(ghClient, prNumber) {
        if (this.reviewers.length > 0) {
            try {
                await ghClient.prAddReviewers(prNumber, this.reviewers);
            } catch (e) {
                throw new Error('Error adding reviewers: ' + e);
            }
        }
        return this.reviewers
    }

    /**
     * Determine if the coordinates allow auto-merge (based on the AUTO_MERGE) and try to merge
     * @param ghClient
     * @param yamlUtils
     * @param prNumber
     * @returns {Promise<void>}
     */
    async tryToMerge(ghClient, yamlUtils, prNumber) {
        let autoMerge = false
        try {
            autoMerge = yamlUtils.determineAutoMerge(this.tenant, this.application, this.environment)
            if(autoMerge) {
                await ghClient.mergePr(prNumber);
            } else {
                console.log(this.tenant + "/" + this.application + "/" + this.environment + " does NOT allow auto-merge!")
            }
            return autoMerge // this returns true only if the pr has been merged
        } catch (e) {
            console.log('Problem reading AUTO_MERGE marker file. Setting auto-merge to false. ' + e)
        }
    }
}

module.exports = PullRequestBuilder;
