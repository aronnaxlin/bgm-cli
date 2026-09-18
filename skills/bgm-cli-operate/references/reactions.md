# Reactions ("贴贴") Reference

Bangumi's reaction feature is called 贴贴 on the site. It lets a user attach one sticker from a fixed set to a reply, an episode comment, a subject collection comment (吐槽箱), or a timeline entry. The p1 endpoints are named `.../like`, but the feature is not a "like" button: the value is one of twelve stickers, each with its own meaning. Never summarize `reactions` as "likes" or "点赞".

Where reactions appear in CLI output:

- `--json` topic, post, episode comment, and timeline payloads carry `reactions: [{ value, users }]`. The `value` is the numeric sticker id below.
- Comment and reply bodies carry inline emote codes such as `(bgm124)`. The same table applies to those codes when they are one of the reaction stickers.

## Current sticker set

Values follow the site's picker order (three rows of four). "Reply" means group topic replies, subject discussion replies, episode comments, and timeline entries. "Collect" means subject collection comments.

| value | emote | targets | reading |
| --- | --- | --- | --- |
| 0 | bgm67 | reply, collect | first slot of the picker; a plain smile. 萌 微笑 开心 |
| 79 | bgm63 | reply | affectionate, kiss. 花痴 亲亲 么么哒 |
| 54 | bgm38 | reply, collect | laughing with tears. 笑哭 |
| 140 | bgm124 | reply, collect | **+1**. Added by the site admin on 2023-04-02 as a shortcut for typing "+1"; the most used reaction on the site. Agreement or endorsement. |
| 62 | bgm46 | reply | closed eyes, blushing, wavy cat mouth: `>w<` `≥﹏≤` `≥ω≤`. Read as excited agreement by most users, as awkwardness by some; often confused with bgm50. |
| 122 | bgm106 | reply, collect | sparkling eyes. 星星眼 期待 火眼金睛 撇嘴笑 |
| 104 | bgm88 | reply, collect | smug, squinting grin. 得意 闷骚 眯眼笑 |
| 80 | bgm64 | reply, collect | infatuated, without the kiss. 花痴 无亲亲 |
| 141 | bgm125 | reply | **?**. Added by the site admin on 2023-04-02 as a shortcut for typing "?". Doubt or objection; the community treats it as the most confrontational reaction available. 问号 反对 |
| 88 | bgm72 | reply, collect | cute, mouthless stare. 萌 无口 |
| 85 | bgm69 | reply | cute surprise. 萌 惊讶 |
| 90 | bgm74 | reply, collect | crying quietly. 流泪 默默流泪 |

Only `140` (+1) is close to "agree". Treat everything else as an emotional sticker, not a vote.

## Retired stickers

These values still appear in old data but cannot be posted any more. The site hides them from the picker; the server rejects them on write.

| value | emote | note |
| --- | --- | --- |
| 118 | bgm102 | "流汗" (sweat). Removed around 2023-05-24 after heavy hostile use; read as pure disapproval. |
| 53 | bgm37 | retired |
| 92 | bgm76 | retired |
| 60 | bgm44 | retired |
| 128 | bgm112 | retired |
| 47 | bgm31 | retired |
| 68 | bgm52 | retired |
| 137 | bgm121 | retired |
| 76 | bgm60 | retired |
| 132 | bgm116 | retired |

## Writing reactions

```bash
bgm group like-post <post_id> 140
bgm subject like-post <post_id> 141
bgm episode like-comment <comment_id> 54
bgm timeline like <timeline_id> 0
bgm subject like-collect <collect_id> 140
```

- Reply-type targets accept all twelve current values.
- Subject collection comments accept only `0, 54, 80, 88, 90, 104, 122, 140`; `79`, `62`, `141`, `85` are rejected there.
- One reaction per user per target; a second `like` replaces the first. Use the matching `unlike` command to remove it.
- Reactions are rate limited per user (10 per minute at the time of writing). Do not retry a rejected reaction in a loop.
- Reactions are anonymous on the site and send no notification, but the `users` array in `--json` output does list who reacted.

## Sources

- Feature announcement by the site admin: https://bgm.tv/group/topic/379812
- Extension to subject collection comments: https://bgm.tv/group/topic/388835
- Server allow-lists: `lib/like.ts` in https://github.com/bangumi/server-private
- Frontend value to emote mapping: `packages/utils/reactions.ts` in https://github.com/bangumi/frontend
- Community readings of individual stickers: https://bgm.tv/group/topic/453824 and https://bgm.tv/group/topic/453798
