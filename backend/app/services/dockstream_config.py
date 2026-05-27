"""Generate DockStream JSON configuration for each target."""

import json
from typing import Any


class DockStreamConfigGenerator:
    """Generate a DockStream-compatible JSON configuration for Vina docking."""

    def __init__(
        self,
        target_name: str,
        pdbqt_path: str,
        center_x: float,
        center_y: float,
        center_z: float,
        size_x: float,
        size_y: float,
        size_z: float,
        exhaustiveness: int = 16,
        number_poses: int = 3,
        seed: int = 42,
        docking_backend: str = "vina",
        target_index: int = 0,
    ):
        self.target_name = target_name
        self.pdbqt_path = pdbqt_path
        self.center_x = center_x
        self.center_y = center_y
        self.center_z = center_z
        self.size_x = size_x
        self.size_y = size_y
        self.size_z = size_z
        self.exhaustiveness = exhaustiveness
        self.number_poses = number_poses
        self.seed = seed
        self.docking_backend = docking_backend
        self.target_index = target_index

    def generate(self) -> dict:
        params: dict[str, Any] = {
            "parallelization": {"number_cores": 16},
            "seed": self.seed,
            "receptor_pdbqt_path": [self.pdbqt_path],
            "number_poses": self.number_poses,
            "search_space": {
                "--center_x": self.center_x,
                "--center_y": self.center_y,
                "--center_z": self.center_z,
                "--size_x": self.size_x,
                "--size_y": self.size_y,
                "--size_z": self.size_z,
            },
        }
        if self.docking_backend == "vina_gpu":
            params["binary_location"] = "/opt/Vina-GPU"
        else:
            params["binary_location"] = "/opt/conda_envs/dockstream_env/bin"

        return {
            "docking": {
                "ligand_preparation": {
                    "embedding_pools": [
                        {
                            "pool_id": "RDkit",
                            "type": "RDkit",
                            "input": {
                                "standardize_smiles": True,
                                "type": "console",
                            },
                        }
                    ]
                },
                "docking_runs": [
                    {
                        "run_id": self.target_name,
                        "backend": "AutoDockVina",
                        "input_pools": ["RDkit"],
                        "parameters": params,
                        "output": {
                            "poses": {
                                "poses_path": f"/output/poses_t{self.target_index}.sdf",
                            },
                            "scores": {
                                "scores_path": f"/output/scores_t{self.target_index}.csv",
                            },
                        },
                    }
                ],
            }
        }

    def generate_json(self) -> str:
        return json.dumps(self.generate(), indent=2)


def generate_target_config(
    target: Any,
    override: Any | None,
    mount_prefix: str = "/data/targets",
    docking_backend: str = "vina",
    target_index: int = 0,
) -> str:
    cx = override.center_x if override and override.center_x is not None else target.center_x
    cy = override.center_y if override and override.center_y is not None else target.center_y
    cz = override.center_z if override and override.center_z is not None else target.center_z
    sx = override.size_x if override and override.size_x is not None else target.size_x
    sy = override.size_y if override and override.size_y is not None else target.size_y
    sz = override.size_z if override and override.size_z is not None else target.size_z
    exh = override.exhaustiveness if override and override.exhaustiveness is not None else target.exhaustiveness

    pdbqt_path = f"{mount_prefix}/{target.pdbqt_filename}"

    gen = DockStreamConfigGenerator(
        target_name=target.name,
        pdbqt_path=pdbqt_path,
        center_x=cx,
        center_y=cy,
        center_z=cz,
        size_x=sx,
        size_y=sy,
        size_z=sz,
        exhaustiveness=exh,
        docking_backend=docking_backend,
        target_index=target_index,
    )
    return gen.generate_json()
