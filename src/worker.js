import { loadConfig } from "./config.js";
import { GitHubVaultStore } from "./github-vault-store.js";
import { VaultPathPolicy } from "./path-policy.js";
import { ProposalTokenSigner } from "./proposal-token.js";
import { routeRequest } from "./routes.js";
import { SystemClock, VaultService } from "./vault-service.js";

export default {
  async fetch(request, env) {
    const config = loadConfig(env);
    const clock = new SystemClock();
    const service = new VaultService({
      store: new GitHubVaultStore({ ...config.github, maxSearchFiles: config.maxSearchFiles }),
      pathPolicy: new VaultPathPolicy(),
      proposalSigner: new ProposalTokenSigner({
        secret: config.proposalTokenSecret,
        ttlSeconds: config.proposalTtlSeconds,
        clock,
      }),
      limits: {
        maxNoteBytes: config.maxNoteBytes,
        maxSearchFiles: config.maxSearchFiles,
      },
      clock,
    });
    return routeRequest(request, service, config);
  },
};
