import 'react-pro-sidebar/dist/css/styles.css';
import {
  ProSidebar,
  Menu,
  MenuItem,
  SubMenu,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
} from 'react-pro-sidebar';
import { FaTachometerAlt, FaGem, FaList, FaGithub, FaRegLaughWink, FaHeart } from 'react-icons/fa';
// import { Button } from 'semantic-ui-react';

import './sidebar.scss';
import './sidebar.css';

export default () => {
	return(
		<ProSidebar breakPoint="md">
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
			</SidebarFooter>
		</ProSidebar>
	);
}
