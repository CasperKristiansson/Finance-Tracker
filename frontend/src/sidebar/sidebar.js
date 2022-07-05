import 'react-pro-sidebar/dist/css/styles.css';
import {
  ProSidebar,
  Menu,
  MenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
} from 'react-pro-sidebar';
import { FaTachometerAlt, FaGem, FaRegLaughWink } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';

import './sidebar.scss';
import './sidebar.css';

export default () => {
	return(
		<ProSidebar breakPoint="md" style={{position: "fixed"}}>
			<SidebarHeader>
				<div className="sidebar-logo">
					<h1>FinanceTracker</h1>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<Menu iconShape="circle">
					<MenuItem icon={<FaTachometerAlt />}>
						Overview
					</MenuItem>
					<MenuItem icon={<FaGem />}>
						Months
					</MenuItem>
				</Menu>

				<Menu iconShape="circle">
					<MenuItem icon={<FaRegLaughWink />}>
						Report
					</MenuItem>
				</Menu>
			</SidebarContent>

			<SidebarFooter style={{ textAlign: 'center' }}>
        <div
          className="sidebar-btn-wrapper"
          style={{
            padding: '20px 24px',
          }}
        >
					<a
            href="https://github.com/azouaoui-med/react-pro-sidebar"
            target="_blank"
            className="sidebar-btn"
            rel="noopener noreferrer"
          >
          <FiSettings />
          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            Settings
          </span>
					</a>
        </div>
      </SidebarFooter>
    </ProSidebar>
	);
}
