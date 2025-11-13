import { useState, useEffect } from "react";
import { api, type NodeResponse } from "./client";
import "./App.scss";

function App() {
    const [tree, setTree] = useState<NodeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                const data = await api.getTree();
                setTree(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTree();
    }, []);

    if (loading)
        return (
            <div className="app-container">
                <p className="loading">Loading tree...</p>
            </div>
        );
    if (error)
        return (
            <div className="app-container">
                <p className="error">Error: {error}</p>
            </div>
        );
    if (!tree)
        return (
            <div className="app-container">
                <p className="no-data">No tree found.</p>
            </div>
        );

    return (
        <div className="app-container">
            <h1>Norm Tree Viewer</h1>
            <div className="tree-container">
                <TreeView node={tree} />
            </div>
        </div>
    );
}

function TreeView({ node }: { node: NodeResponse }) {
    const getStatusClass = (status: string | null | undefined) => {
        if (!status) return "status-unknown";
        if (status === "PASS") return "status-pass";
        if (status === "FAIL") return "status-fail";
        return "status-unknown";
    };

    const handleOverride = async () => {
        const newStatus = node.status === "PASS" ? "FAIL" : "PASS";
        try {
            const resp = await api.patchNode(
                node.id,
                newStatus,
                "override manually"
            );
            console.log(resp);
        } catch (err: any) {
            console.error("Failed to override node:", err);
            alert(`Failed to override: ${err.message}`);
        }
    };

    return (
        <div className="tree-node">
            <div className="node-header">
                <span className="node-name">{node.name}</span>
                <span className="node-type">{node.type}</span>
                {node.type !== "ROOT" && (
                    <>
                        <span
                            className={`node-status ${getStatusClass(
                                node.status
                            )}`}
                        >
                            {node.status ?? "UNKNOWN"}
                        </span>
                        <button
                            className="override-button"
                            onClick={handleOverride}
                        >
                            Override
                        </button>
                    </>
                )}
            </div>
            {node.reason && <div className="node-reason">{node.reason}</div>}
            {node.children?.length > 0 && (
                <div className="node-children">
                    {node.children.map((child) => (
                        <TreeView key={child.id} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default App;
