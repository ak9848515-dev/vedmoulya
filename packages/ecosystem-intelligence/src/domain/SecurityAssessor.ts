// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// SecurityAssessor — EPIC-015
//
// Security gate for discovered repositories/tools. Deterministic,
// evidence-attached classification. NEVER claims a repo is \"safe\" —
// the strongest verdict is \"no blocking indicators found in the checks
// performed\". Never executes untrusted code on the VedMoulya host:
// when the environment cannot safely sandbox a repository it is marked
// SECURITY_REVIEW_REQUIRED and is not executed automatically.
// ──────────────────────────────────────────────────────────────────

import type {
  RepositorySecurityAssessment,
  SecurityCheck,
  SecurityClassification,
} from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

/** Facts about a repository gathered by the (read-only) GitHub source. */
export interface RepositoryFacts {
  fullName: string;
  /** Scripts that run on install (install/pre/postinstall). */
  installScripts: string[];
  shellUsage: boolean;
  subprocessUsage: boolean;
  arbitraryCommandExecution: boolean;
  credentialCollection: boolean;
  environmentAccess: boolean;
  filesystemAccess: boolean;
  sshKeyAccess: boolean;
  browserCredentialAccess: boolean;
  networkCalls: boolean;
  unknownBinaries: boolean;
  encodedOrObfuscatedScripts: boolean;
  /** Suspicious dependency indicators (typosquatting, unmaintained). */
  suspiciousDependencies: string[];
  dependencyVulnerabilities: string[];
  abandonedDependencies: boolean;
  unsignedBinaries: boolean;
  suspiciousReleaseArtifacts: boolean;
  dockerPrivileges: boolean;
  hostFilesystemMounts: boolean;
  excessivePermissions: boolean;
  secretExposure: boolean;
  outboundDataTransfer: boolean;
  dynamicDownloads: boolean;
  remoteCodeExecutionPaths: boolean;
  /** Whether THIS environment can sandbox the repository. */
  sandboxAvailable: boolean;
  /** Software license identifier when known (fed to the license engine). */
  license?: string;
}

const SAFE_LANGUAGE = 'No blocking indicators found in the checks performed.';

export class SecurityAssessor {
  constructor(private readonly clock: ClockPort) {}

  assess(facts: RepositoryFacts): RepositorySecurityAssessment {
    const checks: SecurityCheck[] = [];
    const blocking: string[] = [];

    this.check(
      checks,
      blocking,
      'install_scripts',
      facts.installScripts.length === 0,
      facts.installScripts.length > 0
        ? `Install lifecycle scripts present: ${facts.installScripts.join(', ')} — reviewed before any install.`
        : SAFE_LANGUAGE,
      facts.installScripts.map((s) => `script:${s}`),
    );

    this.check(
      checks,
      blocking,
      'credential_collection',
      !facts.credentialCollection,
      'Credential-collection indicators detected — this repo must never run with access to secrets.',
      ['credential_collection'],
    );

    this.check(
      checks,
      blocking,
      'secret_exposure',
      !facts.secretExposure,
      'Secret-exposure indicators detected (hardcoded/embedded secrets).',
      ['secret_exposure'],
    );

    this.check(
      checks,
      blocking,
      'arbitrary_command_execution',
      !facts.arbitraryCommandExecution,
      'Arbitrary command-execution path detected — execute only inside a sandbox after review.',
      ['rce'],
    );

    this.check(
      checks,
      blocking,
      'remote_code_execution',
      !facts.remoteCodeExecutionPaths,
      'Remote code-execution path detected — never executed automatically.',
      ['remote_code_execution'],
    );

    this.check(
      checks,
      blocking,
      'ssh_key_access',
      !facts.sshKeyAccess,
      'SSH key access detected — host credentials must never be reachable.',
      ['ssh_key_access'],
    );

    this.check(
      checks,
      blocking,
      'browser_credential_access',
      !facts.browserCredentialAccess,
      'Browser credential access detected.',
      ['browser_credentials'],
    );

    this.check(
      checks,
      blocking,
      'outbound_data_transfer',
      !facts.outboundDataTransfer,
      'Outbound data-transfer path detected — user data could leave the host.',
      ['outbound_transfer'],
    );

    // ── Review-level signals (downgrade but do not always block) ──
    this.check(
      checks,
      blocking,
      'shell_subprocess_usage',
      !facts.shellUsage && !facts.subprocessUsage,
      'Shell/subprocess usage present — requires review before execution.',
      ['shell', 'subprocess'],
    );

    this.check(
      checks,
      blocking,
      'obfuscated_scripts',
      !facts.encodedOrObfuscatedScripts,
      'Encoded/obfuscated scripts present — requires manual review.',
      ['obfuscation'],
    );

    this.check(
      checks,
      blocking,
      'dynamic_downloads',
      !facts.dynamicDownloads,
      'Dynamic downloads present — install-time fetch requires review.',
      ['dynamic_download'],
    );

    this.check(
      checks,
      blocking,
      'suspicious_dependencies',
      facts.suspiciousDependencies.length === 0,
      facts.suspiciousDependencies.length > 0
        ? `Suspicious dependency indicators: ${facts.suspiciousDependencies.join(', ')}.`
        : SAFE_LANGUAGE,
      facts.suspiciousDependencies,
    );

    this.check(
      checks,
      blocking,
      'dependency_vulnerabilities',
      facts.dependencyVulnerabilities.length === 0,
      facts.dependencyVulnerabilities.length > 0
        ? `Known dependency vulnerabilities: ${facts.dependencyVulnerabilities.join(', ')}.`
        : SAFE_LANGUAGE,
      facts.dependencyVulnerabilities,
    );

    this.check(
      checks,
      blocking,
      'abandoned_dependencies',
      !facts.abandonedDependencies,
      'Abandoned dependencies present — maintenance risk.',
      ['abandoned_deps'],
    );

    this.check(
      checks,
      blocking,
      'unsigned_binaries',
      !facts.unsignedBinaries,
      'Unsigned binaries present — supply-chain risk.',
      ['unsigned_binaries'],
    );

    this.check(
      checks,
      blocking,
      'suspicious_release_artifacts',
      !facts.suspiciousReleaseArtifacts,
      'Suspicious release artifacts detected.',
      ['release_artifacts'],
    );

    this.check(
      checks,
      blocking,
      'docker_privileges',
      !facts.dockerPrivileges,
      'Privileged Docker configuration detected — container escape risk.',
      ['docker_privileged'],
    );

    this.check(
      checks,
      blocking,
      'host_filesystem_mounts',
      !facts.hostFilesystemMounts,
      'Host filesystem mounts in container configuration.',
      ['docker_host_mount'],
    );

    this.check(
      checks,
      blocking,
      'excessive_permissions',
      !facts.excessivePermissions,
      'Excessive permission requests detected.',
      ['excessive_permissions'],
    );

    this.check(
      checks,
      blocking,
      'environment_access',
      !facts.environmentAccess,
      'Environment variable access present — secrets must be redacted from logs.',
      ['env_access'],
    );

    this.check(
      checks,
      blocking,
      'filesystem_access',
      !facts.filesystemAccess,
      'Broad filesystem access present — requires review before execution.',
      ['filesystem'],
    );

    this.check(
      checks,
      blocking,
      'network_calls',
      !facts.networkCalls,
      'Network calls present — outbound traffic requires review.',
      ['network'],
    );

    this.check(
      checks,
      blocking,
      'unknown_binaries',
      !facts.unknownBinaries,
      'Unknown binaries present — cannot verify provenance.',
      ['unknown_binaries'],
    );

    // ── Classification (deterministic, evidence-first) ─────────────
    const classification = this.classify(blocking, facts, checks);

    // Sandbox policy: when the repo contains executable content and the
    // environment cannot sandbox it, mark SECURITY_REVIEW_REQUIRED and
    // never auto-execute.
    const hasExecutableContent =
      facts.installScripts.length > 0 ||
      facts.arbitraryCommandExecution ||
      facts.remoteCodeExecutionPaths;
    const sandboxRequired = hasExecutableContent && classification !== 'BLOCKED';
    const sandboxUnavailable = sandboxRequired && !facts.sandboxAvailable;
    const finalClassification =
      sandboxUnavailable &&
      (classification === 'TRUSTED' || classification === 'TRUSTED_WITH_REVIEW')
        ? 'SECURITY_REVIEW_REQUIRED'
        : classification;

    return {
      classification: finalClassification,
      checks,
      blockingIndicators: [...blocking],
      sandboxRequired: sandboxRequired && !sandboxUnavailable,
      sandboxAvailable: facts.sandboxAvailable,
      assessedAt: this.clock.now(),
    };
  }

  private classify(
    blocking: string[],
    facts: RepositoryFacts,
    checks: SecurityCheck[],
  ): SecurityClassification {
    if (blocking.length > 0) return 'BLOCKED';
    const reviewSignals = checks.filter((c) => !c.passed && !blocking.includes(c.name)).length;
    if (reviewSignals >= 4) return 'SECURITY_REVIEW_REQUIRED';
    if (reviewSignals >= 1) return 'TRUSTED_WITH_REVIEW';
    return 'TRUSTED';
  }

  private check(
    checks: SecurityCheck[],
    blocking: string[],
    name: string,
    passed: boolean,
    detail: string,
    evidence: string[],
  ): void {
    checks.push({ name, passed, detail: passed ? SAFE_LANGUAGE : detail, evidence });
    if (
      !passed &&
      [
        'credential_collection',
        'secret_exposure',
        'arbitrary_command_execution',
        'remote_code_execution',
        'ssh_key_access',
        'browser_credential_access',
        'outbound_data_transfer',
      ].includes(name)
    ) {
      blocking.push(name);
    }
  }
}
