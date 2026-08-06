import os
import sys
import time
import subprocess
import argparse

# \nCelery启动脚本\n
# 支持启动worker和beat
# (空行)


def print_info(message):
    print(f"[INFO] {message}")


def print_success(message):
    print(f"[OK] {message}")


def print_error(message):
    print(f"[ERROR] {message}")


def start_worker(queues="default", concurrency=4):
    """启动Celery Worker"""
    cmd = [
        sys.executable,
        "-m",
        "celery",
        "-A",
        "tasks",
        "worker",
        "--loglevel=info",
        "-Q",
        queues,
        "-c",
        str(concurrency),
        "--hostname=worker@%h",
    ]
    print_info(f"Starting Celery worker with queues: {queues}")
    print_info(f"Command: {' '.join(cmd)}")
    try:
        process = subprocess.Popen(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
        print_success("Celery worker started successfully")
        return process
    except Exception as e:
        print_error(f"Failed to start Celery worker: {e}")
        return None


def start_beat():
    """启动Celery Beat"""
    cmd = [sys.executable, "-m", "celery", "-A", "tasks", "beat", "--loglevel=info"]
    print_info("Starting Celery Beat")
    print_info(f"Command: {' '.join(cmd)}")
    try:
        process = subprocess.Popen(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
        print_success("Celery Beat started successfully")
        return process
    except Exception as e:
        print_error(f"Failed to start Celery Beat: {e}")
        return None


def main():
    print("\n" + "=" * 60)
    print("    Celery Task Manager")
    print("=" * 60)
    parser = argparse.ArgumentParser(description="Start Celery workers and beat")
    parser.add_argument("--worker", action="store_true", help="Start Celery worker")
    parser.add_argument("--beat", action="store_true", help="Start Celery beat")
    parser.add_argument("--all", action="store_true", help="Start both worker and beat")
    parser.add_argument(
        "-q",
        "--queues",
        default="default,mqtt,export,notification,email,cleanup,report",
        help="Comma-separated list of queues to consume",
    )
    parser.add_argument("-c", "--concurrency", type=int, default=4, help="Number of worker processes")
    args = parser.parse_args()
    processes = []
    if args.worker or args.all:
        worker_proc = start_worker(args.queues, args.concurrency)
        if worker_proc:
            processes.append(("worker", worker_proc))
    if args.beat or args.all:
        beat_proc = start_beat()
        if beat_proc:
            processes.append(("beat", beat_proc))
    if not processes:
        print_error("No processes to start. Use --worker, --beat, or --all")
        parser.print_help()
        sys.exit(1)
    print_info(f"\nStarted {len(processes)} process(es)")
    try:
        while True:
            time.sleep(5)
            for name, proc in processes:
                if proc.poll() is not None:
                    print_error(f"{name} process terminated with code {proc.returncode}")
                    processes.remove((name, proc))
            if not processes:
                print_error("All processes have terminated")
                break
    except KeyboardInterrupt:
        print_info("\nReceived shutdown signal")
        for name, proc in processes:
            print_info(f"Stopping {name}...")
            proc.terminate()
            proc.wait()
        print_success("All processes stopped")


if __name__ == "__main__":
    main()
