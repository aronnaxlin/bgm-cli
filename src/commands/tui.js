import process from "node:process";
import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, formatDisplayResult } from "../core/output.js";
import { runUserCommand } from "./user.js";
import { executeSubjectListCommand, executeSubjectSearchCommand } from "./subject.js";
import {
  executeCollectionCollectCommand,
  executeCollectionCommentCommand,
  executeCollectionGetCommand,
  executeCollectionListCommand,
  executeCollectionRateCommand,
  executeCollectionStatusCommand,
} from "./collection.js";
import {
  executeGroupGetCommand,
  executeGroupListCommand,
  executeGroupMembersCommand,
  executeGroupTopicCommand,
  executeGroupTopicsCommand,
  executeHotGroupTopicsCommand,
  executeHotGroupsCommand,
  executeLatestRepliedGroupTopicsCommand,
  executeRecentGroupTopicsCommand,
} from "./group.js";
import {
  askMenuChoice,
  askTuiOptional,
  askTuiRequired,
  waitForTuiContinue,
} from "../utils/tui-interactive.js";
import {
  clearScreen,
  drawBoxLine,
  drawBoxText,
  drawDivider,
  drawSectionTitle,
  inverse,
  isTuiBackAction,
  renderTuiHeader,
  renderTuiResultScreen,
} from "../utils/tui-render.js";
import {
  buildPagedMenu,
  formatCollectionMenuLabel,
  formatCollectionSnapshotSummary,
  formatCollectionStatusLabel,
  formatCriteriaSummary,
  formatGroupMenuLabel,
  formatGroupTopicMenuLabel,
  formatPageSummary,
  formatSubjectMenuLabel,
  formatSubjectTypeLabel,
} from "../utils/formatters.js";
import {
  buildCollectionTargetArgs,
  fetchTuiCollectionSnapshot,
  getCollectionStatusKey,
} from "../utils/collection-ops.js";

export async function runTui(context, deps = {}) {
  if (context.json) {
    throw new CommandError("bgm tui does not support --json because it requires interactive prompts.");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CommandError("bgm tui requires an interactive TTY terminal.");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const action = await askMenuChoice(
        "Choose an action",
        [
          { key: "1", label: "Subject: search subjects by keyword", value: "subject-search" },
          { key: "2", label: "Subject: fetch one subject by ID", value: "subject-get" },
          { key: "3", label: "Subject: browse subjects by type", value: "subject-list" },
          { key: "4", label: "Collection: list one user's collections", value: "collection-list" },
          { key: "5", label: "Collection: show one collection entry", value: "collection-get" },
          { key: "6", label: "Collection: create or update a collection", value: "collection-collect" },
          { key: "7", label: "Collection: update collection comment", value: "collection-comment" },
          { key: "8", label: "Collection: update collection rating", value: "collection-rate" },
          { key: "9", label: "Collection: update collection status", value: "collection-status" },
          { key: "10", label: "User: show current authenticated user", value: "user-me" },
          { key: "11", label: "User: fetch one public user profile", value: "user-get" },
          { key: "12", label: "Group: browse Bangumi groups", value: "group" },
          { key: "13", label: "System: setup and config", value: "system" },
          { key: "0", label: "Exit", value: "exit" },
        ],
        "subject-search",
        {
          quitValue: "exit",
          quitLabel: "exit",
        },
      );

      if (action === "exit") {
        clearScreen();
        console.log("");
        console.log("Bye.");
        return;
      }

      console.log("");
      const actionResult = await runTuiAction(rl, action, context, deps);
      if (actionResult === "exit") {
        clearScreen();
        console.log("");
        console.log("Bye.");
        return;
      }
      if (actionResult === "menu") {
        continue;
      }

      await waitForTuiContinue();
    }
  } finally {
    rl.close();
  }
}

async function runTuiAction(rl, action, context, deps) {
  switch (action) {
    case "system": {
      const systemAction = await askMenuChoice(
        "System",
        [
          { key: "1", label: "Setup: install bgm into PATH", value: "setup-install-path" },
          { key: "2", label: "Setup: update managed install", value: "setup-update" },
          { key: "3", label: "Config: show current config", value: "config-show" },
          { key: "4", label: "Config: set one config value", value: "config-set" },
          { key: "5", label: "Config: unset one config value", value: "config-unset" },
          { key: "0", label: "Back", value: "back" },
        ],
        "0",
      );
      if (isTuiBackAction(systemAction)) {
        return "menu";
      }
      return runTuiAction(rl, systemAction, context, deps);
    }
    case "group": {
      const groupAction = await askMenuChoice(
        "Groups",
        [
          { key: "1", label: "Joined groups: quick topics", value: "group-joined-topics" },
          { key: "2", label: "List groups", value: "group-list" },
          { key: "3", label: "Open one group", value: "group-get" },
          { key: "4", label: "List one group's topics", value: "group-topics" },
          { key: "5", label: "Open one topic", value: "group-topic" },
          { key: "6", label: "List group members", value: "group-members" },
          { key: "7", label: "Recent group topics", value: "group-recent-topics" },
          { key: "8", label: "Latest replied topics", value: "group-latest-replies" },
          { key: "9", label: "Hot groups", value: "group-hot" },
          { key: "a", label: "Hot topics", value: "group-hot-topics" },
          { key: "0", label: "Back", value: "back" },
        ],
        "1",
      );
      if (isTuiBackAction(groupAction)) {
        return "menu";
      }
      return runTuiAction(rl, groupAction, context, deps);
    }
    case "config-show":
      await deps.runConfigCommand("show", [], context);
      return;
    case "config-set": {
      const key = await askMenuChoice(
        "Config key",
        [
          { key: "1", label: "accessToken", value: "accessToken" },
          { key: "2", label: "refreshToken", value: "refreshToken" },
          { key: "3", label: "clientId", value: "clientId" },
          { key: "4", label: "clientSecret", value: "clientSecret" },
          { key: "5", label: "redirectUri", value: "redirectUri" },
          { key: "6", label: "oauthServerBaseUrl", value: "oauthServerBaseUrl" },
          { key: "7", label: "userAgent", value: "userAgent" },
          { key: "8", label: "timezone", value: "timezone" },
        ],
        "accessToken",
      );
      if (isTuiBackAction(key)) {
        return "menu";
      }
      const value = await askTuiRequired(rl, `Value for ${key}`);
      await deps.runConfigCommand("set", [key, value], context);
      return;
    }
    case "config-unset": {
      const key = await askMenuChoice(
        "Config key",
        [
          { key: "1", label: "accessToken", value: "accessToken" },
          { key: "2", label: "refreshToken", value: "refreshToken" },
          { key: "3", label: "clientId", value: "clientId" },
          { key: "4", label: "clientSecret", value: "clientSecret" },
          { key: "5", label: "redirectUri", value: "redirectUri" },
          { key: "6", label: "oauthServerBaseUrl", value: "oauthServerBaseUrl" },
          { key: "7", label: "userAgent", value: "userAgent" },
          { key: "8", label: "timezone", value: "timezone" },
        ],
        "accessToken",
      );
      if (isTuiBackAction(key)) {
        return "menu";
      }
      await deps.runConfigCommand("unset", [key], context);
      return;
    }
    case "setup-install-path":
      await deps.runSetupCommand("install-path", [], context);
      return;
    case "setup-update":
      await deps.runSetupCommand("update", [], context);
      return;
    case "user-me":
      await runUserCommand("me", [], context);
      return;
    case "user-get": {
      const username = await askTuiRequired(rl, "Username or numeric user ID");
      await runUserCommand("get", [username], context);
      return;
    }
    case "group-list": {
      const mode = await askMenuChoice(
        "List mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "managed", value: "managed" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "created", value: "created" },
          { key: "2", label: "updated", value: "updated" },
          { key: "3", label: "posts", value: "posts" },
          { key: "4", label: "topics", value: "topics" },
          { key: "5", label: "members", value: "members" },
        ],
        "created",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = ["--mode", mode, "--sort", sort, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupListCommand(args);
      await browseGroupResults(result, context, { mode, sort, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-joined-topics": {
      const groupsResult = await executeGroupListCommand(["--mode", "joined", "--sort", "updated", "--limit", "100"]);
      const group = await pickGroupResult(groupsResult, {
        mode: "joined",
        sort: "updated",
        limit: "100",
      });
      if (!group?.name) {
        return "menu";
      }

      const topicsResult = await executeGroupTopicsCommand([String(group.name), "--limit", "20"]);
      await browseGroupTopicResults(topicsResult, context, {
        source: "joined groups",
        group: group.name,
        limit: "20",
      });
      return "menu";
    }
    case "group-get": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const result = await executeGroupGetCommand([groupName]);
      renderTuiResultScreen("Group detail", formatDisplayResult(result, context));
      return;
    }
    case "group-topics": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = [groupName, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupTopicsCommand(args);
      await browseGroupTopicResults(result, context, { group: groupName, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-topic": {
      const topicId = await askTuiRequired(rl, "Topic ID");
      const replyLimit = await askMenuChoice(
        "Reply excerpts",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(replyLimit)) {
        return "menu";
      }
      const result = await executeGroupTopicCommand([topicId, "--reply-limit", replyLimit]);
      renderTuiResultScreen("Group topic", formatDisplayResult(result, context));
      return;
    }
    case "group-members": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const role = await askMenuChoice(
        "Role filter",
        [
          { key: "1", label: "All roles", value: "" },
          { key: "2", label: "visitor", value: "visitor" },
          { key: "3", label: "guest", value: "guest" },
          { key: "4", label: "member", value: "member" },
          { key: "5", label: "creator", value: "creator" },
          { key: "6", label: "moderator", value: "moderator" },
          { key: "7", label: "blocked", value: "blocked" },
        ],
        "",
      );
      if (isTuiBackAction(role)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = [groupName, "--limit", limit];
      if (role) {
        args.push("--role", role);
      }
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupMembersCommand(args);
      renderTuiResultScreen(
        "Group members",
        formatDisplayResult(result, context),
        formatCriteriaSummary({ group: groupName, role: role || "all", limit, offset: offset || "0" }),
      );
      return;
    }
    case "group-recent-topics": {
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = ["--mode", mode, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeRecentGroupTopicsCommand(args);
      await browseGroupTopicResults(result, context, { mode, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-latest-replies": {
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "50", value: "50" },
          { key: "2", label: "100", value: "100" },
          { key: "3", label: "200", value: "200" },
          { key: "4", label: "500", value: "500" },
        ],
        "100",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeLatestRepliedGroupTopicsCommand(["--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupTopicResults(result, context, { mode, limit, scan });
      return "menu";
    }
    case "group-hot": {
      const window = await askMenuChoice(
        "Window",
        [
          { key: "1", label: "day", value: "day" },
          { key: "2", label: "week", value: "week" },
          { key: "3", label: "month", value: "month" },
        ],
        "day",
      );
      if (isTuiBackAction(window)) {
        return "menu";
      }
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "100", value: "100" },
          { key: "2", label: "200", value: "200" },
          { key: "3", label: "500", value: "500" },
          { key: "4", label: "1000", value: "1000" },
        ],
        "200",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeHotGroupsCommand(["--window", window, "--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupResults(result, context, { window, mode, limit, scan });
      return "menu";
    }
    case "group-hot-topics": {
      const window = await askMenuChoice(
        "Window",
        [
          { key: "1", label: "day", value: "day" },
          { key: "2", label: "week", value: "week" },
          { key: "3", label: "month", value: "month" },
        ],
        "day",
      );
      if (isTuiBackAction(window)) {
        return "menu";
      }
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "100", value: "100" },
          { key: "2", label: "200", value: "200" },
          { key: "3", label: "500", value: "500" },
          { key: "4", label: "1000", value: "1000" },
        ],
        "200",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeHotGroupTopicsCommand(["--window", window, "--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupTopicResults(result, context, { window, mode, limit, scan });
      return "menu";
    }
    case "subject-get": {
      const subjectId = await askTuiRequired(rl, "Subject ID");
      const client = new BangumiClient(getConfig());
      const subject = await client.getSubject(subjectId);
      await browseSubjectDetailActions(client, subject, context);
      return "menu";
    }
    case "subject-list": {
      const type = await askMenuChoice(
        "Subject type",
        [
          { key: "1", label: "book", value: "book" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "music", value: "music" },
          { key: "4", label: "game", value: "game" },
          { key: "5", label: "real", value: "real" },
        ],
        "anime",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "rank", value: "rank" },
          { key: "2", label: "date", value: "date" },
        ],
        "rank",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const year = await askTuiOptional(rl, "Year filter", "");
      const month = await askTuiOptional(rl, "Month filter", "");
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = ["--type", type];
      if (sort) {
        args.push("--sort", sort);
      }
      if (year) {
        args.push("--year", year);
      }
      if (month) {
        args.push("--month", month);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeSubjectListCommand(args);
      await browseSubjectResults(result, context, {
        mode: "list",
        type,
        sort,
        year: year || "any",
        month: month || "any",
        limit,
      });
      return "menu";
    }
    case "subject-search": {
      const keyword = await askTuiRequired(rl, "Keyword");
      const type = await askMenuChoice(
        "Type filter",
        [
          { key: "1", label: "All types", value: "" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "book", value: "book" },
          { key: "4", label: "music", value: "music" },
          { key: "5", label: "game", value: "game" },
          { key: "6", label: "real", value: "real" },
        ],
        "",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "match", value: "match" },
          { key: "2", label: "heat", value: "heat" },
          { key: "3", label: "rank", value: "rank" },
          { key: "4", label: "score", value: "score" },
        ],
        "match",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = [keyword];
      if (type) {
        args.push("--type", type);
      }
      if (sort) {
        args.push("--sort", sort);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeSubjectSearchCommand(args);
      await browseSubjectResults(result, context, {
        mode: "search",
        keyword,
        type: type || "all",
        sort,
        limit,
      });
      return "menu";
    }
    case "collection-list": {
      const targetMode = await askMenuChoice(
        "Collection target user",
        [
          { key: "1", label: "Current authenticated user", value: "me" },
          { key: "2", label: "Enter a username manually", value: "manual" },
        ],
        "me",
      );
      if (isTuiBackAction(targetMode)) {
        return "menu";
      }
      const username = targetMode === "manual" ? await askTuiRequired(rl, "Username") : "";
      const type = await askMenuChoice(
        "Type filter",
        [
          { key: "1", label: "All types", value: "" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "book", value: "book" },
          { key: "4", label: "music", value: "music" },
          { key: "5", label: "game", value: "game" },
          { key: "6", label: "real", value: "real" },
        ],
        "",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const status = await askMenuChoice(
        "Status filter",
        [
          { key: "1", label: "All statuses", value: "" },
          { key: "2", label: "wish", value: "wish" },
          { key: "3", label: "collect", value: "collect" },
          { key: "4", label: "doing", value: "doing" },
          { key: "5", label: "on_hold", value: "on_hold" },
          { key: "6", label: "dropped", value: "dropped" },
        ],
        "",
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "updated", value: "updated" },
          { key: "2", label: "name", value: "name" },
          { key: "3", label: "rank", value: "rank" },
          { key: "4", label: "community_score", value: "community_score" },
          { key: "5", label: "user_score", value: "user_score" },
          { key: "6", label: "date", value: "date" },
        ],
        "updated",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const order = await askMenuChoice(
        "Order",
        [
          { key: "1", label: "desc", value: "desc" },
          { key: "2", label: "asc", value: "asc" },
        ],
        "desc",
      );
      if (isTuiBackAction(order)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = [];
      if (username) {
        args.push("--user", username);
      }
      if (status) {
        args.push("--status", status);
      }
      if (type) {
        args.push("--type", type);
      }
      if (sort) {
        args.push("--sort", sort);
      }
      if (order) {
        args.push("--order", order);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeCollectionListCommand(args);
      await browseCollectionResults(result, context, {
        user: username || "(current user)",
        type: type || "all",
        status: status || "all",
        sort,
        order,
        limit,
      });
      return "menu";
    }
    case "collection-get": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const result = await executeCollectionGetCommand(buildCollectionTargetArgs(target));
      renderTuiResultScreen("Collection detail", formatDisplayResult(result, context));
      return;
    }
    case "collection-collect": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "wish",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const result = await executeCollectionCollectCommand([
        ...buildCollectionTargetArgs(target),
        status,
      ]);
      renderTuiResultScreen("Collection update", formatDisplayResult(result, context));
      return;
    }
    case "collection-comment": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const commentInput = await askTuiOptional(
        rl,
        "Comment",
        snapshot?.comment ?? "",
        `${formatCollectionSnapshotSummary(snapshot)}\nType a single dash (-) to clear the comment.`,
      );
      const comment = commentInput === "-" ? "" : commentInput;
      const result = await executeCollectionCommentCommand([
        ...buildCollectionTargetArgs(target),
        comment,
      ]);
      renderTuiResultScreen("Collection comment", formatDisplayResult(result, context));
      return;
    }
    case "collection-rate": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const rating = await askMenuChoice(
        "Rating",
        [
          { key: "0", label: "0", value: "0" },
          { key: "1", label: "1", value: "1" },
          { key: "2", label: "2", value: "2" },
          { key: "3", label: "3", value: "3" },
          { key: "4", label: "4", value: "4" },
          { key: "5", label: "5", value: "5" },
          { key: "6", label: "6", value: "6" },
          { key: "7", label: "7", value: "7" },
          { key: "8", label: "8", value: "8" },
          { key: "9", label: "9", value: "9" },
          { key: "10", label: "10", value: "10" },
        ],
        snapshot ? String(snapshot.rate ?? 0) : "7",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(rating)) {
        return "menu";
      }
      const result = await executeCollectionRateCommand([
        ...buildCollectionTargetArgs(target),
        rating,
      ]);
      renderTuiResultScreen("Collection rating", formatDisplayResult(result, context));
      return;
    }
    case "collection-status": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "collect",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const result = await executeCollectionStatusCommand([
        ...buildCollectionTargetArgs(target),
        status,
      ]);
      renderTuiResultScreen("Collection status", formatDisplayResult(result, context));
      return;
    }
    default:
      throw new CommandError(`Unsupported TUI action: ${action}`);
  }
}

async function askTuiCollectionTarget(rl) {
  const targetMode = await askMenuChoice(
    "Collection target",
    [
      { key: "1", label: "Enter subject ID directly", value: "id" },
      { key: "2", label: "Search subjects and choose one", value: "search" },
    ],
    "id",
  );

  if (isTuiBackAction(targetMode)) {
    return "menu";
  }

  if (targetMode === "id") {
    const subjectId = await askTuiRequired(rl, "Subject ID");
    return { mode: "id", subjectId };
  }

  const keyword = await askTuiRequired(rl, "Keyword");
  const type = await askMenuChoice(
    "Type filter",
    [
      { key: "1", label: "All types", value: "" },
      { key: "2", label: "anime", value: "anime" },
      { key: "3", label: "book", value: "book" },
      { key: "4", label: "music", value: "music" },
      { key: "5", label: "game", value: "game" },
      { key: "6", label: "real", value: "real" },
    ],
    "",
  );
  if (isTuiBackAction(type)) {
    return "menu";
  }

  const sort = await askMenuChoice(
    "Sort",
    [
      { key: "1", label: "match", value: "match" },
      { key: "2", label: "heat", value: "heat" },
      { key: "3", label: "rank", value: "rank" },
      { key: "4", label: "score", value: "score" },
    ],
    "match",
  );
  if (isTuiBackAction(sort)) {
    return "menu";
  }

  const limit = await askMenuChoice(
    "Limit",
    [
      { key: "1", label: "10", value: "10" },
      { key: "2", label: "20", value: "20" },
      { key: "3", label: "50", value: "50" },
    ],
    "10",
  );
  if (isTuiBackAction(limit)) {
    return "menu";
  }

  const args = [keyword];
  if (type) {
    args.push("--type", type);
  }
  if (sort) {
    args.push("--sort", sort);
  }
  if (limit) {
    args.push("--limit", limit);
  }

  const result = await executeSubjectSearchCommand(args);
  const subjects = Array.isArray(result?.data) ? result.data : [];
  if (subjects.length === 0) {
    renderTuiResultScreen("Subject results", formatDisplayResult(result, {}), "No target found.");
    await waitForTuiContinue();
    return "menu";
  }

  const choice = await askMenuChoice(
    "Choose subject",
    [
      ...subjects.map((subject, index) => ({
        key: String(index + 1),
        label: formatSubjectMenuLabel(subject),
        value: String(index),
      })),
      { key: "0", label: "Back", value: "back" },
    ],
    "0",
    {
      summary: formatCriteriaSummary({
        keyword,
        type: type || "all",
        sort,
        limit,
      }),
    },
  );

  if (isTuiBackAction(choice)) {
    return "menu";
  }

  const subject = subjects[Number(choice)];
  if (!subject?.id) {
    return "menu";
  }

  return {
    mode: "id",
    subjectId: String(subject.id),
  };
}

async function browseSubjectResults(result, context, criteria = {}) {
  const client = new BangumiClient(getConfig());
  const subjects = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (subjects.length === 0) {
    renderTuiResultScreen("Subject results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(subjects, pageIndex, formatSubjectMenuLabel);
    const choice = await askMenuChoice(
      "Subject results",
      [
        ...page.items.map((subject, index) => ({
          key: String(index + 1),
          label: formatSubjectMenuLabel(subject),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(subjects.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const subject = subjects[Number(choice)];
    if (!subject) {
      continue;
    }

    await browseSubjectDetailActions(client, subject, context);
  }
}

async function browseCollectionResults(result, context, criteria = {}) {
  const client = new BangumiClient(getConfig());
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Collection results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatCollectionMenuLabel);
    const choice = await askMenuChoice(
      "Collection results",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatCollectionMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const item = items[Number(choice)];
    if (!item?.subject_id) {
      continue;
    }

    await browseSubjectDetailActions(
      client,
      {
        id: item.subject_id,
        name_cn: item?.subject?.name_cn,
        name: item?.subject?.name,
      },
      context,
    );
  }
}

async function browseGroupResults(result, context, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Group results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupMenuLabel);
    const choice = await askMenuChoice(
      "Group results",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const group = items[Number(choice)];
    const groupName = group?.name;
    if (!groupName) {
      renderTuiResultScreen("Group result", formatDisplayResult(group, context));
      await waitForTuiContinue();
      continue;
    }

    const detail = await executeGroupGetCommand([String(groupName)]);
    renderTuiResultScreen("Group detail", formatDisplayResult(detail, context));
    await waitForTuiContinue();
  }
}

async function pickGroupResult(result, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Choose group", formatDisplayResult(result, {}), summary || "No groups found.");
    await waitForTuiContinue();
    return null;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupMenuLabel);
    const choice = await askMenuChoice(
      "Choose group",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return null;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const group = items[Number(choice)];
    if (group) {
      return group;
    }
  }
}

async function browseGroupTopicResults(result, context, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Group topics", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupTopicMenuLabel);
    const choice = await askMenuChoice(
      "Group topics",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupTopicMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const topic = items[Number(choice)];
    if (!topic?.id) {
      continue;
    }

    const detail = await executeGroupTopicCommand([String(topic.id), "--reply-limit", "20"]);
    renderTuiResultScreen("Group topic", formatDisplayResult(detail, context));
    await waitForTuiContinue();
  }
}

async function askSubjectDetailAction(detail, subject) {
  renderTuiHeader();
  console.log(drawSectionTitle("Subject detail"));
  console.log(drawDivider());
  console.log(formatDisplayResult(detail, {}));
  console.log("");
  console.log(drawDivider());
  console.log(`Selected subject: #${subject.id} ${subject.name_cn || subject.name || "-"}`);
  console.log("Actions");
  console.log("  [1/c] collect  [2/o] open collection  [3/m] comment");
  console.log("  [4/r] rate     [5/s] status           [0/b/q] back");

  emitKeypressEvents(process.stdin);

  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const mapping = {
      "1": "collect",
      c: "collect",
      "2": "collection-get",
      o: "collection-get",
      "3": "comment",
      m: "comment",
      "4": "rate",
      r: "rate",
      "5": "status",
      s: "status",
      "0": "back",
      b: "back",
      q: "back",
      escape: "back",
      return: "collection-get",
      enter: "collection-get",
    };

    const onKeypress = (_str, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
        return;
      }

      const raw = typeof _str === "string" ? _str.toLowerCase() : "";
      const action = mapping[raw] ?? mapping[key.name];
      if (!action) {
        return;
      }

      cleanup();
      resolve(action);
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
  });
}

async function browseSubjectDetailActions(client, subject, context) {
  while (true) {
    const detail = await client.getSubject(subject.id);
    const action = await askSubjectDetailAction(detail, subject);

    if (isTuiBackAction(action)) {
      return;
    }

    const result = await runTuiSubjectCollectionAction(subject.id, action);
    renderTuiResultScreen("Collection result", formatDisplayResult(result, context));
    await waitForTuiContinue();
  }
}

async function runTuiSubjectCollectionAction(subjectId, action) {
  switch (action) {
    case "collection-get":
      return executeCollectionGetCommand([String(subjectId)]);
    case "collect": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "wish",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionCollectCommand([String(subjectId), status]);
    }
    case "comment": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const commentInput = await askTuiOptional(
          rl,
          "Comment",
          snapshot?.comment ?? "",
          `${formatCollectionSnapshotSummary(snapshot)}\nType a single dash (-) to clear the comment.`,
        );
        const comment = commentInput === "-" ? "" : commentInput;
        return executeCollectionCommentCommand([String(subjectId), comment]);
      } finally {
        rl.close();
      }
    }
    case "rate": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const rating = await askMenuChoice(
        "Rating",
        [
          { key: "0", label: "0", value: "0" },
          { key: "1", label: "1", value: "1" },
          { key: "2", label: "2", value: "2" },
          { key: "3", label: "3", value: "3" },
          { key: "4", label: "4", value: "4" },
          { key: "5", label: "5", value: "5" },
          { key: "6", label: "6", value: "6" },
          { key: "7", label: "7", value: "7" },
          { key: "8", label: "8", value: "8" },
          { key: "9", label: "9", value: "9" },
          { key: "10", label: "10", value: "10" },
        ],
        snapshot ? String(snapshot.rate ?? 0) : "7",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(rating)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionRateCommand([String(subjectId), rating]);
    }
    case "status": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "collect",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionStatusCommand([String(subjectId), status]);
    }
    default:
      throw new CommandError(`Unsupported subject collection action: ${action}`);
  }
}
