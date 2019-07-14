import Post from "discourse/models/post";
import { cookAsync } from "discourse/lib/text";
import {
  ENCRYPT_ACTIVE,
  decryptPost,
  getEncryptionStatus,
  getTopicKey,
  hasTopicKey
} from "discourse/plugins/discourse-encrypt/lib/discourse";

export default {
  name: "hook-decrypt-revision",

  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (getEncryptionStatus(currentUser) !== ENCRYPT_ACTIVE) {
      return;
    }

    Post.reopenClass({
      loadRevision() {
        return this._super(...arguments).then(result => {
          if (!hasTopicKey(result.topic_id)) {
            return result;
          }

          const topicKey = getTopicKey(result.topic_id);
          return Promise.all([
            topicKey.then(k => decryptPost(k, result.raws.previous)),
            topicKey.then(k => decryptPost(k, result.raws.current))
          ])
            .then(([previous, current]) =>
              Promise.all([
                previous,
                cookAsync(previous),
                current,
                cookAsync(current)
              ])
            )
            .then(([prevRaw, prevCooked, currRaw, currCooked]) => {
              result.body_changes.side_by_side = `
                <div class="revision-content">${prevCooked}</div>
                <div class="revision-content">${currCooked}</div>`;
              result.body_changes.side_by_side_markdown = `
                <table class="markdown">
                  <tr>
                    <td class="diff-del">${prevRaw}</td>
                    <td class="diff-ins">${currRaw}</td>
                  </tr>
                </table>`;
              return result;
            });
        });
      }
    });
  }
};
