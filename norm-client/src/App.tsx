import { useState, useEffect } from "react";
import { api, type Node } from "./client";
import "./App.scss";

function App() {
    const [tree, setTree] = useState<Node | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rootId, setRootId] = useState<number | null>(null);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                const data = await api.getTree();
                setTree(data);
                setRootId(data.id);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchTree();
    }, []);

    const refreshRoot = async () => {
        if (rootId === null) {
            setError("rootId should be set");
        } else {
            try {
                const data = await api.getNode(rootId);
                setTree(data);
                setRootId(data.id);
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

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
                <TreeView node={tree} onOverrideComplete={refreshRoot} />
            </div>
        </div>
    );
}

function TreeView({
    node,
    onOverrideComplete,
}: {
    node: Node;
    onOverrideComplete: () => void;
}) {
    const [showReasonInput, setShowReasonInput] = useState(false);
    const [reasonText, setReasonText] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"PASS" | "FAIL">("PASS");

    const getStatusClass = (status: string | null | undefined) => {
        if (!status) return "status-unknown";
        if (status === "PASS") return "status-pass";
        if (status === "FAIL") return "status-fail";
        return "status-unknown";
    };

    const handleOverrideClick = () => {
        const defaultStatus = node.status === "PASS" ? "FAIL" : "PASS";
        setSelectedStatus(defaultStatus as "PASS" | "FAIL");
        setShowReasonInput(true);
    };

    const handleSubmitOverride = async () => {
        try {
            // Unused variable -- I opted not to flatted nodes in the frontend to minimize complexity.
            // Flattening and updating O(1) will improve performance if tree is deeply nested.
            api.patchNode(node.id, selectedStatus, reasonText).then(() => {
                onOverrideComplete();
                setShowReasonInput(false);
                setReasonText("");
            });
        } catch (err: any) {
            console.error("Failed to override node:", err);
            alert(`Failed to override: ${err.message}`);
        }
    };

    const handleCancelOverride = () => {
        setShowReasonInput(false);
        setReasonText("");
    };

    const getPlaceholder = () => {
        return selectedStatus === "PASS" ? "Content is compliant" : "Content is not compliant";
    };

    return (
        <div className="tree-node">
            <div className="node-header">
                <span className="node-type">{node.type}</span>
                <span className="node-name">{node.name}</span>
                {node.type !== "ROOT" && (
                    <>
                        <span
                            className={`node-status ${getStatusClass(
                                node.status
                            )}`}
                        >
                            {node.status ?? "UNKNOWN"}
                        </span>
                        {!showReasonInput ? (
                            <button
                                className="override-button"
                                onClick={handleOverrideClick}
                            >
                                Override
                            </button>
                        ) : (
                            <div className="override-input-container">
                                <div className="status-toggle">
                                    <button
                                        className={`status-toggle-button ${selectedStatus === "PASS" ? "active status-pass" : ""}`}
                                        onClick={() => setSelectedStatus("PASS")}
                                    >
                                        PASS
                                    </button>
                                    <button
                                        className={`status-toggle-button ${selectedStatus === "FAIL" ? "active status-fail" : ""}`}
                                        onClick={() => setSelectedStatus("FAIL")}
                                    >
                                        FAIL
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="override-input"
                                    placeholder={getPlaceholder()}
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    className="override-submit"
                                    onClick={handleSubmitOverride}
                                >
                                    Submit
                                </button>
                                <button
                                    className="override-cancel"
                                    onClick={handleCancelOverride}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            {node.reason && <div className="node-reason">{node.reason}</div>}
            {node.children?.length > 0 && (
                <div className="node-children">
                    {node.children.map((child) => (
                        <TreeView
                            key={child.id}
                            node={child}
                            onOverrideComplete={onOverrideComplete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default App;
