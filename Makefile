MSG_1 = "Initial Update"

branch_1 = main

git-push : 
		git add . 
		git commit -m ${MSG_1}
		git push origin ${branch_1}


git-change : 
			git checkout ${Branch_2}


package : 
		pip install -r requirements.txt 

upgrade : 
		pip install --upgrade pip 
			