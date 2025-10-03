"""Upload a local file to the bastion host via AWS Systems Manager."""

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Path to the local file to upload")
    parser.add_argument(
        "--remote-dir",
        default="/home/ec2-user",
        help="Remote directory on the bastion host (default: /home/ec2-user)",
    )
    parser.add_argument(
        "--tf-dir",
        default="infra/terraform",
        help="Terraform directory containing the bastion outputs (default: infra/terraform)",
    )
    parser.add_argument(
        "--profile",
        default="Personal",
        help="AWS CLI profile to use (default: Personal)",
    )
    parser.add_argument(
        "--region",
        default="eu-north-1",
        help="AWS region where the bastion lives (default: eu-north-1)",
    )
    return parser.parse_args()


def get_bastion_instance_id(tf_dir: str) -> str:
    result = subprocess.run(
        ["terraform", f"-chdir={tf_dir}", "output", "-raw", "bastion_instance_id"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or "Unable to retrieve bastion_instance_id"
        raise RuntimeError(message)

    instance_id = result.stdout.strip()
    if not instance_id:
        raise RuntimeError("Bastion instance ID is empty. Run `make tf-enable-bastion` first.")
    return instance_id


def send_command(
    *,
    instance_id: str,
    profile: str,
    region: str,
    local_file: Path,
    remote_dir: str,
) -> None:
    payload = base64.b64encode(local_file.read_bytes()).decode("ascii")
    commands = [
        f"cat <<'EOF' | base64 -d > {remote_dir.rstrip('/')}/{local_file.name}",
        payload,
        "EOF",
    ]
    params = json.dumps({"commands": commands})

    result = subprocess.run(
        [
            "aws",
            "ssm",
            "send-command",
            "--profile",
            profile,
            "--region",
            region,
            "--document-name",
            "AWS-RunShellScript",
            "--instance-ids",
            instance_id,
            "--comment",
            f"Upload {local_file.name}",
            "--parameters",
            params,
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        message = result.stderr.strip() or "aws ssm send-command failed"
        raise RuntimeError(message)


def main() -> int:
    args = parse_args()

    if not args.file.is_file():
        print(f"File not found: {args.file}", file=sys.stderr)
        return 1

    try:
        instance_id = get_bastion_instance_id(args.tf_dir)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    try:
        send_command(
            instance_id=instance_id,
            profile=args.profile,
            region=args.region,
            local_file=args.file,
            remote_dir=args.remote_dir,
        )
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    print(
        f"Uploaded {args.file} to {args.remote_dir.rstrip('/')}/{args.file.name} on bastion {instance_id}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
