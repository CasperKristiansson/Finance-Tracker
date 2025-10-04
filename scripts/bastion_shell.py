"""Open an AWS SSM Session Manager shell on the bastion host."""

import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
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


def main() -> int:
    args = parse_args()

    try:
        instance_id = get_bastion_instance_id(args.tf_dir)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    command = [
        "aws",
        "ssm",
        "start-session",
        "--profile",
        args.profile,
        "--region",
        args.region,
        "--target",
        instance_id,
    ]

    result = subprocess.run(command)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
