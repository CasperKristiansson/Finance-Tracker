<p align="center">
<img src="https://user-images.githubusercontent.com/36133918/192075691-b5892073-923e-4d1e-ae62-3ad963725e7f.png" height="400"/>
</p>

# Finance Tracker

_A project which solved an issue of mine which was tracking my finance. This Finance Tracking application gives overviews of expenses and income to give its users an easy way to explore their data._

I have always been interested in finance and personal economics. Therefore, for the past five years, I have been tracking every single expense or income that I have made. And like most people, I then visualized that data in excel. But creating advanced views with dynamic categories became extremely hard and required a lot of work.

An easy solution for this (kind of time-consuming 😊) was to in a more programmatic way explore and manage my personal finance. The application allows me to, in a much faster and easy way track month-to-month expenses and income.

## Technologies Used

- **MYSQL** database to store transactions and loans
- The website is made using **React** and website authentication is made using **Firebase**
- Eight different **API endpoints** were developed to manage the data between the application and the database
- Python Pandas to clean the old transaction data

<p align="center">
<img src="https://user-images.githubusercontent.com/36133918/192075699-af6a3a35-a098-4d0d-bb82-da15273d24ad.jpg" height="400"/>
</p>

## Features

The overview page is what the user is first presented with when entering the website. The overview view gives the user an insight into last month's income and expenses and a bar chart for this year's income and expenses. The page also includes two sections where the user can either add a new transaction or upload an excel document. The second part of the page includes a list of transactions where the user can easily navigate and see the different transactions made. The table gives the user the option to edit each transaction.

The two most important pages are the yearly and total overview. Both these pages give deep insight into exactly which income/expense categories exist and exactly how much each source is. With the yearly overview, the user can explore how much the user has made an impact on their NET growth. The total view gives more insight into comparing the years towards each other.

A big part of keeping track of personal finance is knowing exactly where all the existing money is located. As you grow older you usually will end up with more and more different bank accounts, investment portfolios, and saving accounts. The accounts overview gives the exact amount that exists in each account. One thing that I had a really hard time with before when tracking in excel is that even after tracking all the monthly expenses the accounts wouldn’t always line up with the real-world amount. Therefore, the transaction page also gives it user a way to edit the balance and then track it as an adjustment.

Another big thing in managing finance is that it must be easy to create new, edit or delete transactions. The application with help of API endpoints can easily perform all of these actions against the database. A biig functionality added to the application is uploading an excel document. The user can upload an excel document with a list of expenses and income which the application can post to the database. This makes it easy to manage the finance from month to month.
