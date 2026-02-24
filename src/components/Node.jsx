/**
 * Node.jsx - 节点组件
 *
 * 用法说明：
 *   在ReactFlow的nodeTypes中注册使用
 *   const nodeTypes = { baseNode: Node }
 *   <ReactFlow nodeTypes={nodeTypes} />
 *
 * 组件职责：
 *   1. 渲染节点的输入端口组、节点名称、输出端口组
 *   2. 处理节点的点击、右键、双击事件
 *   3. 处理输入端口的拖拽断线重连逻辑
 *
 * 节点交互逻辑（开发目标.txt第51-62行）：
 *   - 单击节点：Ctrl按下则切换选中，否则清空并选中当前
 *   - 右键节点：选中当前节点，显示菜单和面板
 *   - 双击节点：打开重命名弹窗
 *
 * 端口交互逻辑（开发目标.txt第63-69行）：
 *   - 拖拽已连接的输入端口：断开连接，从源端口重新拖拽
 */
import { Button } from "@heroui/react";
import { Handle, Position, useEdges, useReactFlow } from "@xyflow/react"; // ReactFlow组件和hooks
import { setState, getState, useStore } from "../store"; // 状态管理
import { computeStructHash } from "../commands/Node"; // 结构指纹计算
import "../styles/Node.css"; // 样式

const DRAG_THRESHOLD = 5; // 拖拽阈值（像素）

// ==================== 辅助函数 ====================

/**
 * findConnectedEdge - 查找连接到输入端口的边
 *
 * 用法：const edge = findConnectedEdge(edges, nodeId, handleId)
 */
const findConnectedEdge = (edges, nodeId, handleId) => {
	// 查找连接到指定输入端口的边
	return edges.find((e) => e.target === nodeId && e.targetHandle === handleId);
};

/**
 * simulateDragFromSource - 模拟从源端口开始拖拽
 *
 * 用法：simulateDragFromSource(edge, mouseEvent)
 * 功能：找到源端口DOM，触发mousedown事件启动ReactFlow连线
 */
const simulateDragFromSource = (edge, event) => {
	// 模拟从源端口开始拖拽
	const selector = `[data-nodeid="${edge.source}"][data-handleid="${edge.sourceHandle}"]`; // 源端口选择器
	const handle = document.querySelector(selector); // 查找源端口DOM
	if (!handle) return; // 找不到则返回

	const fakeEvent = new MouseEvent("mousedown", {
		// 创建模拟事件
		bubbles: true, // 冒泡
		cancelable: true, // 可取消
		clientX: event.clientX, // 鼠标X
		clientY: event.clientY, // 鼠标Y
		button: 0, // 左键
	});
	handle.dispatchEvent(fakeEvent); // 触发事件
};

/**
 * startDragDetection - 开始拖拽检测
 *
 * 用法：startDragDetection(mouseDownEvent, edge, setEdges)
 * 功能：监听鼠标移动，超过阈值后断开连接并从源端口重新拖拽
 */
const startDragDetection = (event, edge, setEdges) => {
	// 开始拖拽检测
	const startX = event.clientX; // 起始X
	const startY = event.clientY; // 起始Y
	let hasDragged = false; // 是否已触发拖拽

	const onMove = (e) => {
		// 鼠标移动处理
		const dx = Math.abs(e.clientX - startX); // X移动距离
		const dy = Math.abs(e.clientY - startY); // Y移动距离
		if (hasDragged) return; // 已触发则跳过
		if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) return; // 未超阈值则跳过

		hasDragged = true; // 标记已触发
		setEdges((eds) => eds.filter((e) => e.id !== edge.id)); // 删除边
		simulateDragFromSource(edge, e); // 从源端口拖拽
		cleanup(); // 清理
	};

	const onUp = () => cleanup(); // 鼠标抬起则清理

	const cleanup = () => {
		// 清理函数
		document.removeEventListener("mousemove", onMove); // 移除移动监听
		document.removeEventListener("mouseup", onUp); // 移除抬起监听
	};

	document.addEventListener("mousemove", onMove); // 添加移动监听
	document.addEventListener("mouseup", onUp); // 添加抬起监听
};

// ==================== 端口组件 ====================

/**
 * InputPort - 输入端口组件
 *
 * 用法：<InputPort id="x" label="输入1" nodeId="node_1" edges={edges} setEdges={setEdges} />
 * 功能：渲染输入端口，处理拖拽断线重连
 */
const InputPort = ({ id, label, nodeId, edges, setEdges }) => {
	// 输入端口组件

	const onMouseDown = (e) => {
		// 鼠标按下处理
		const edge = findConnectedEdge(edges, nodeId, id); // 查找连接的边（使用id而不是name）
		if (!edge) return; // 无连接则返回
		e.stopPropagation(); // 阻止冒泡
		startDragDetection(e, edge, setEdges); // 开始拖拽检测
	};

	const displayLabel = label; // 显示标签（优先使用label，否则使用id）

	return (
		<div className="port-item">
			<Handle type="target" position={Position.Left} id={id} className="handle" onMouseDown={onMouseDown} />
			<span className="input-label">{displayLabel}</span>
		</div>
	);
};

/**
 * OutputPort - 输出端口组件
 *
 * 用法：<OutputPort id="out" label="输出" />
 * 功能：渲染输出端口
 */
const OutputPort = ({ id, label }) => {
	// 输出端口组件
	const displayLabel = label; // 显示标签（优先使用label，否则使用id）
	return (
		<div className="port-item">
			<span className="output-label">{displayLabel}</span>
			<Handle type="source" position={Position.Right} id={id} className="handle" />
		</div>
	);
};

// ==================== 节点主组件 ====================

/**
 * Node - 节点主组件
 *
 * 用法：在ReactFlow的nodeTypes中注册 { baseNode: Node }
 * 功能：渲染节点，处理交互事件
 */
const Node = ({ id, data }) => {
	// 节点组件

	// ===== 数据 =====
	const edges = useEdges(); // 获取所有边
	const { setEdges } = useReactFlow(); // 获取setEdges
	const registry = useStore(s => s.registry); // 获取最新registry

	const color = data?.color || "rgb(137, 146, 235)"; // 节点颜色

	const label = data?.name || data?.label || "未命名节点"; // 节点名称

	// ===== 过时检测 =====
	const opcode = data?.opcode; // 节点opcode
	const latestDef = registry?.nodes?.[opcode]; // 从registry取最新定义
	const isDeleted = !latestDef; // opcode在registry中不存在
	const isStale = isDeleted || (data?.structHash && computeStructHash(latestDef) !== data.structHash); // 结构指纹不匹配或已删除

	// 适配新旧两种格式的端口数据
	const inputPorts = data?.ports?.input || data?.ports?.in || {}; // 输入端口（新格式是对象，旧格式是数组）
	const outputPorts = data?.ports?.output || data?.ports?.out || {}; // 输出端口（新格式是对象，旧格式是数组）

	// 将端口数据统一转换为数组格式 [{ id: "x", label: "输入1" }, ...]
	const inputs = Array.isArray(inputPorts) // 判断是否为数组（旧格式）
		? inputPorts.map((name) => ({ id: name, label: name })) // 旧格式：数组转对象数组
		: Object.entries(inputPorts).map(([id, label]) => ({ id, label })); // 新格式：对象转对象数组

	const outputs = Array.isArray(outputPorts) // 判断是否为数组（旧格式）
		? outputPorts.map((name) => ({ id: name, label: name })) // 旧格式：数组转对象数组
		: Object.entries(outputPorts).map(([id, label]) => ({ id, label })); // 新格式：对象转对象数组

	// ===== 事件处理 =====

	const hideMenuIfNeeded = () => {
		// 如果当前节点不是菜单/面板绑定的节点，就隐藏
		const { nodeMenu, nodePanel } = getState();                    // 获取菜单和面板状态
		if (id !== nodeMenu.nodeId && id !== nodePanel.nodeId) {       // 不是绑定节点
			setState({ nodeMenu: { visible: false }, nodePanel: { visible: false } }); // 隐藏菜单和面板
		}
	};

	const onClick = (e) => {
		// 单击处理
		e.stopPropagation(); // 阻止冒泡
		const isCtrl = e.ctrlKey || e.metaKey; // 是否按Ctrl
		if (isCtrl) {
			window.cmd.toggleSelectNode(id); // Ctrl+点击切换选中
		} else {
			const node = getState().nodes.find(n => n.id === id);      // 获取当前节点
			if (!node?.selected) {                                     // 未选中才清空重选，保护多选状态
				window.cmd.clearSelect(); // 清空选中
				window.cmd.selectNode(id); // 选中当前
			}
		}
		hideMenuIfNeeded(); // 处理菜单可见性
	};

	const onContextMenu = (e) => {
		// 右键处理
		e.preventDefault(); // 阻止默认
		e.stopPropagation(); // 阻止冒泡
		window.cmd.selectNode(id, true); // 选中当前
		setState({
			// 显示菜单和面板
			nodeMenu: { visible: true, nodeId: id },
			nodePanel: { visible: true, nodeId: id },
		});
	};

	const onDoubleClick = (e) => {
		// 双击处理
		e.stopPropagation(); // 阻止冒泡
		window.cmd.selectNode(id); // 选中当前
		const node = getState().nodes.find((n) => n.id === id); // 获取节点
		const currentName = node?.data?.name || ""; // 当前名称
		setState({
			// 显示重命名弹窗
			renameModal: {
				visible: true,
				nodeIds: [id],
				placeholder: currentName,
				value: currentName,
			},
		});
	};

	// ===== 渲染 =====

	return (
		<Button className="container" style={{ background: color, "--node-color": color, position: "relative" }} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
			{/* 过时遮罩 */}
			{isStale && (
				<div className="stale-overlay">
					<span>{isDeleted ? "节点已删除" : "定义已更新"}</span>
				</div>
			)}

			{/* 输入端口组 */}
			<div className="port-container">
				{inputs.map((port, i) => (
					<InputPort key={`in-${port.id}-${i}`} id={port.id} label={port.label} nodeId={id} edges={edges} setEdges={setEdges} />
				))}
			</div>

			{/* 节点名称 */}
			<div className="title-container">
				<div className="title">{label}</div>
			</div>

			{/* 输出端口组 */}
			<div className="port-container">
				{outputs.map((port, i) => (
					<OutputPort key={`out-${port.id}-${i}`} id={port.id} label={port.label} />
				))}
			</div>
		</Button>
	);
};

export default Node;
