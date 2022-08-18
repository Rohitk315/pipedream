import queries from "../../common/queries.mjs";
import common from "../common/common-webhook-orgs.mjs";

export default {
  ...common,
  key: "github-new-issue-with-status",
  name: "New Issue with Status (Projects V2)",
  description: "Emit new event when a project issue is tagged with a specific status. Currently supports Organization Projects only. [More information here](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project)",
  version: "0.0.1",
  type: "source",
  dedupe: "unique",
  props: {
    ...common.props,
    project: {
      propDefinition: [
        common.props.github,
        "projectV2",
        (c) => ({
          org: c.org,
          repo: c.repo,
        }),
      ],
    },
    status: {
      propDefinition: [
        common.props.github,
        "status",
        (c) => ({
          org: c.org,
          repo: c.repo,
          project: c.project,
        }),
      ],
    },
  },
  methods: {
    ...common.methods,
    getWebhookEvents() {
      return [
        "projects_v2_item",
      ];
    },
    generateMeta(issue, statusName) {
      const { number } = issue;
      const ts = Date.parse(issue.updated_at);
      return {
        id: `${number}-${ts}`,
        summary: `Issue #${number} in ${statusName} status`,
        ts,
      };
    },
    isRelevant(item, issueNumber, statusName) {
      let isRelevant = true;
      let message = "";
      const {
        type,
        isArchived,
        fieldValueByName: { optionId },
      } = item;

      if (type !== "ISSUE") {
        message = `Not an issue: ${type}. Skipping...`;
        isRelevant = false;
      } else if (isArchived) {
        message = "Issue is archived. Skipping...";
        isRelevant = false;
      } else if (optionId !== this.status) {
        message = `Issue #${issueNumber} in ${statusName} status. Skipping...`;
        isRelevant = false;
      }

      if (message) console.log(message);
      return isRelevant;
    },
    async getProjectItem({ nodeId }) {
      const { node } = await this.github.graphql(queries.projectItemQuery, {
        nodeId,
      });
      return node;
    },
  },
  async run({ body: event }) {
    if (event.zen) {
      console.log(event.zen);
      return;
    }

    const item = await this.getProjectItem({
      nodeId: event.projects_v2_item.node_id,
    });

    const issueNumber = item.content.number;
    const statusName = item.fieldValueByName.name;

    if (!this.isRelevant(item, issueNumber, statusName)) {
      return;
    }

    const issue = await this.github.getIssue({
      repoFullname: `${this.org}/${this.repo}`,
      issueNumber,
    });

    console.log(`Emitting issue #${issueNumber}`);
    const meta = this.generateMeta(issue, statusName);
    this.$emit(issue, meta);
  },
};
